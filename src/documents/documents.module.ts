import { Module, forwardRef } from '@nestjs/common'; // 1. IMPORTE 'forwardRef'
import { PdfService } from './pdf.service.js';
import { QuotationsModule } from 'src/quotations/quotations.module.js';

@Module({
  imports: [forwardRef(() => QuotationsModule)], // 2. USE forwardRef() AQUI
  providers: [PdfService],
  exports: [PdfService],
})
export class DocumentsModule { }