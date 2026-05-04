import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SswService {
    // Usamos o endpoint de API rastreamento que suporta XML/JSON
    private readonly apiUrl = 'https://ssw.inf.br/api/tracking';

    constructor(private readonly httpService: HttpService) { }

    async getTracking(nf: string, cnpj: string): Promise<any[]> {
        try {
            console.log(`[SSW] Iniciando rastreio NF: ${nf}, CNPJ: ${cnpj}`);

            // Tenta primeiro como Remetente (RS)
            console.log(`[SSW] Tentando rastreio como Remetente (RS) para NF: ${nf}, CNPJ: ${cnpj}`);
            let events = await this.performRequest(nf, cnpj, 'RS');

            // Se não encontrou nada ou deu erro de "não localizado", tenta como Destinatário (DS)
            if (this.isNotFound(events)) {
                console.log('[SSW] Não encontrado como Remetente. Tentando como Destinatário...');
                events = await this.performRequest(nf, cnpj, 'DS');
            }

            // Se ainda não encontrou nada, retorna mensagem amigável
            if (this.isNotFound(events)) {
                return [{
                    date: new Date().toISOString(),
                    status: 'SSW: Documento não localizado (tentado como remetente e destinatário).',
                    location: 'API SSW'
                }];
            }

            return events;
        } catch (error: any) {
            console.error(`[SSW] Erro no rastreio: ${error.message}`);
            return [{
                date: new Date().toISOString(),
                status: `Erro de conexão: ${error.message}`,
                location: 'API SSW'
            }];
        }
    }

    private async performRequest(nf: string, cnpj: string, type: 'RS' | 'DS'): Promise<any[]> {
        const payload: any = {
            NR: nf,
            JSON: 'S'
        };
        payload[type] = cnpj.replace(/\D/g, '');

        try {
            const response = await firstValueFrom(
                this.httpService.post(this.apiUrl, new URLSearchParams(payload).toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    timeout: 10000
                }),
            );

            const data = response.data;

            // 1. Tenta tratar como JSON estruturado
            if (data && typeof data === 'object' && data.documentos) {
                const doc = data.documentos[0];
                if (doc && doc.rastreamento) {
                    return doc.rastreamento.map((r: any) => ({
                        date: r.data_hora || r.data,
                        status: r.descricao || r.ocorrencia,
                        location: r.cidade || r.unidade,
                    }));
                }
            }

            // 2. Tenta tratar como XML
            if (typeof data === 'string' && data.includes('<tracking>')) {
                const msgMatch = data.match(/<message>(.*?)<\/message>/);
                if (msgMatch && data.includes('<success>false</success>')) {
                    return [{
                        date: '',
                        status: `SSW: ${msgMatch[1]}`,
                        location: 'NOT_FOUND'
                    }];
                }

                const events: any[] = [];
                const regex = /<dataHora>(.*?)<\/dataHora>.*?<cidadeUnidade>(.*?)<\/cidadeUnidade>.*?<situacao>(.*?)<\/situacao>/gs;
                let match;
                while ((match = regex.exec(data)) !== null) {
                    events.push({
                        date: match[1],
                        location: match[2],
                        status: match[3]
                    });
                }
                if (events.length > 0) return events;
            }

            // 3. Caso receba HTML (provável bloqueio ou redirecionamento)
            if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
                return [{
                    date: new Date().toISOString(),
                    status: 'Consulta exige captcha no portal SSW.',
                    location: 'REDIRECT'
                }];
            }

            return [];
        } catch (e: any) {
            console.error(`[SSW] Falha na sub-requisição ${type}:`, e.message);
            return [];
        }
    }

    private isNotFound(events: any[]): boolean {
        if (!events || events.length === 0) return true;
        // Se o único evento for um 'NOT_FOUND' marcado no location
        if (events.length === 1 && (events[0].location === 'NOT_FOUND' || events[0].location === 'REDIRECT')) return true;
        return false;
    }
}
