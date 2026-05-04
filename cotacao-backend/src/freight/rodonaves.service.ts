import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ProcessedShippingOption } from './frenet.service.js';

@Injectable()
export class RodonavesService {
    private readonly baseUrlAuth = 'https://auth-apigateway.rte.com.br';
    private readonly baseUrlQuotation = 'https://quotation-apigateway.rte.com.br';
    private readonly baseUrlTracking = 'https://tracking-apigateway.rte.com.br';

    private cachedToken: string | null = null;
    private tokenExpiresAt: number = 0;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) { }

    private async getAccessToken(): Promise<string> {
        // Opção 1: Token Fixo (Se o usuário configurou RODONAVES_TOKEN diretamente)
        const fixedToken = this.configService.get<string>('RODONAVES_TOKEN');
        if (fixedToken) {
            return fixedToken;
        }

        const now = Date.now();
        if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
            return this.cachedToken;
        }

        const username = this.configService.get<string>('RODONAVES_USER');
        const password = this.configService.get<string>('RODONAVES_PASSWORD');

        if (!username || !password) {
            throw new InternalServerErrorException('Credenciais da Rodonaves (USER/PASS ou TOKEN) não configuradas.');
        }

        try {
            const authType = this.configService.get<string>('RODONAVES_AUTH_TYPE') || 'DEV';
            const companyId = this.configService.get<string>('RODONAVES_COMPANY_ID');

            const payloadParams: any = {
                auth_type: authType,
                grant_type: 'password',
                username,
                password,
            };

            if (companyId) {
                payloadParams.companyId = companyId;
            }

            const payload = new URLSearchParams(payloadParams);

            // Tentativa com gateway de autenticação padrão
            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrlAuth}/token`, payload.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 25000
                }),
            );

            this.cachedToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 86400;
            this.tokenExpiresAt = now + expiresIn * 1000;

            console.log('[Rodonaves] Autenticado com sucesso.');
            return this.cachedToken!;
        } catch (error: any) {
            console.error('Erro na autenticação Rodonaves:', error.response?.data || error.message);
            throw new InternalServerErrorException('Falha ao autenticar com a Rodonaves. Verifique USER/PASS ou use RODONAVES_TOKEN.');
        }
    }

    async calculateFreight(
        originZip: string,
        destZip: string,
        weightKg: number,
        value: number,
        retry = true
    ): Promise<ProcessedShippingOption | null> {
        try {
            const token = await this.getAccessToken();
            const cnpjRemetente = this.configService.get<string>('RODONAVES_CNPJ') || '00000000000000';

            const payload = {
                OriginZipCode: originZip.replace(/\D/g, ''),
                DestinationZipCode: destZip.replace(/\D/g, ''),
                Weight: weightKg,
                Value: value,
                CustomerTaxId: cnpjRemetente,
            };

            console.log(`[Rodonaves] Payload para Cotação:`, JSON.stringify(payload, null, 2));

            const response = await firstValueFrom(
                this.httpService.post(`${this.baseUrlQuotation}/api/v1/gera-cotacao`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 15000
                }),
            );

            const data = response.data;
            if (!data || !data.Value) {
                console.warn(`[Rodonaves] Resposta da API sem valor de frete:`, data);
                return null;
            }

            const deadline = data.DeliveryTime || 5;
            const price = parseFloat(data.Value);
            const percentage = value > 0 ? (price / value) * 100 : 0;

            console.log(`[Rodonaves] Frete calculado: R$ ${price} (${percentage.toFixed(2)}%)`);

            return {
                carrier: 'RTE Rodonaves',
                service_description: 'Rodonaves Standard',
                price: price,
                deadline: deadline,
                percentage: Number(percentage.toFixed(2)),
                recommendation: 'normal',
            };
        } catch (error: any) {
            if (error.response?.status === 401 && retry) {
                console.log('[Rodonaves] Token expirado na cotação, limpando cache e tentando novamente...');
                this.cachedToken = null;
                return this.calculateFreight(originZip, destZip, weightKg, value, false);
            }
            console.warn('Rodonaves Quotation Error:', error.response?.data || error.message);
            return null;
        }
    }

    async getTracking(nf: string, cnpj: string, retry = true): Promise<any> {
        try {
            console.log(`[Rodonaves] Iniciando rastreio NF: ${nf}, CNPJ: ${cnpj}`);
            const token = await this.getAccessToken();

            const url = `${this.baseUrlTracking}/api/v1/tracking`;
            console.log(`[Rodonaves] GET URL: ${url}`);

            const response = await firstValueFrom(
                this.httpService.get(url, {
                    params: {
                        InvoiceNumber: nf,
                        TaxIdRegistration: cnpj.replace(/\D/g, ''),
                    },
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'accept': 'application/json' 
                    },
                    timeout: 30000 
                }),
            );

            const data = response.data;
            console.log(`[Rodonaves] Resposta recebida. Status: ${response.status}`);

            // Novo formato da API (baseado na documentação enviada)
            if (data && data.Events && Array.isArray(data.Events)) {
                return data.Events.map((event: any) => ({
                    date: event.Date,
                    status: event.Description,
                    location: data.UnitEmi || 'RTE Rodonaves',
                }));
            }

            // Fallback para formato SitTrack se persistir
            if (data && data.SitTrack && Array.isArray(data.SitTrack)) {
                return data.SitTrack.map((event: any) => ({
                    date: event.DateStatus || event.Date,
                    status: event.Description || event.Status,
                    location: event.City || 'RTE Rodonaves',
                }));
            }

            return Array.isArray(data) ? data : [];
        } catch (error: any) {
            if (error.response?.status === 401 && retry) {
                console.log('[Rodonaves] Token expirado no rastreio, limpando cache e tentando novamente...');
                this.cachedToken = null;
                return this.getTracking(nf, cnpj, false);
            }
            console.error(`[Rodonaves] Erro no rastreio: ${error.message}`);

            // Retorna o erro amigavelmente para o frontend exibir na timeline
            const errorMsg = error.response?.data?.Message || error.message;
            return [{
                date: new Date().toISOString(),
                status: `Rodonaves: ${errorMsg}`,
                location: 'API Rodonaves'
            }];
        }
    }
}
