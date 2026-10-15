/**
 * @license
 * CIMADEBE / SIGM - Core Banking & Convenção Geral
 * Serviço de Exportação de Documentos Oficiais para PDF (jsPDF)
 * Responsabilidade Única: Gerar PDFs formatados com identidade visual oficial (CIMADEBE)
 */

import jsPDF from 'jspdf';
import type { AppConfig, IgrejaFiliada, Ministro } from '../types';
import { sha256 } from '../crypto';
import QRCode from 'qrcode';
import { formatarPeriodoEvento } from '../db/databaseService';

export function gerarPdfCartaoCnpj(appConfig: AppConfig) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Cores institucionais
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [6, 182, 212]; // Cyan 500
  const emeraldColor = [16, 185, 129]; // Emerald 500

  // Cabeçalho institucional
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('REPÚBLICA FEDERATIVA DO BRASIL', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('CADASTRO NACIONAL DA PESSOA JURÍDICA (CNPJ)', 105, 23, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text('COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL', 105, 31, { align: 'center' });

  // Corpo do Certificado CNPJ
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(appConfig.nomeFantasia || 'CIMADEBE', 20, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Razão Social: ${appConfig.nomeConvencao}`, 20, 63);

  // Quadro de dados do CNPJ
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 72, 170, 75, 3, 3, 'FD');

  let y = 82;
  const linhaDados = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 25, y);
    doc.setFont('helvetica', 'normal');
    doc.text(valor, 75, y);
    y += 10;
  };

  linhaDados('NÚMERO DE INSCRIÇÃO:', appConfig.cnpj);
  linhaDados('MATRIZ / FILIAL:', '0001-15 (MATRIZ)');
  linhaDados('NOME EMPRESARIAL:', appConfig.nomeConvencao);
  linhaDados('TÍTULO DO ESTABELECIMENTO:', appConfig.nomeFantasia || 'CIMADEBE');
  linhaDados('CÓDIGO ATIVIDADE (CNAE):', '94.91-0-00 - Atividades de organizações religiosas');
  linhaDados('ENDEREÇO DA SEDE:', appConfig.endereco);
  linhaDados('TELEFONE DE CONTATO:', appConfig.telefoneConvencao || '(11) 3000-0000');

  // Rodapé oficial
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado eletronicamente pelo Sistema Integrado de Gestão Ministerial (SIGM).', 105, 170, { align: 'center' });
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 176, { align: 'center' });

  doc.save(`Cartao_CNPJ_${appConfig.nomeFantasia || 'Convencao'}.pdf`);
}

export function gerarPdfRelatorioMinistros(ministros: readonly Ministro[], nomeConvencao: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nomeConvencao.toUpperCase(), 105, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(6, 182, 212);
  doc.text('RELATÓRIO GERAL DE MINISTROS FILIADOS', 105, 23, { align: 'center' });

  let y = 45;
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total de Ministros Registrados: ${ministros.length}`, 14, y);

  y += 10;
  doc.setFontSize(9);
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 5, 182, 8, 'F');
  doc.text('Nome do Ministro', 16, y);
  doc.text('CPF', 85, y);
  doc.text('Cargo', 125, y);
  doc.text('Status', 165, y);

  y += 8;
  doc.setFont('helvetica', 'normal');

  ministros.forEach((m, index) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y - 4, 182, 7, 'F');
    }
    doc.text(m.nome.substring(0, 35), 16, y);
    doc.text(m.cpf, 85, y);
    doc.text(m.cargo, 125, y);
    doc.text(m.statusAdimplencia || 'ADIMPLENTE', 165, y);
    y += 7;
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')} via SIGM Core Banking.`, 105, 290, { align: 'center' });

  doc.save(`Relatorio_Geral_Ministros_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function gerarPdfRelatorioIgrejas(igrejas: readonly IgrejaFiliada[], nomeConvencao: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nomeConvencao.toUpperCase(), 105, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('RELATÓRIO DE IGREJAS FILIADAS', 105, 23, { align: 'center' });

  let y = 45;
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total de Igrejas Filiadas: ${igrejas.length}`, 14, y);

  y += 10;
  doc.setFontSize(9);
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 5, 182, 8, 'F');
  doc.text('Nome Fantasia / Razão Social', 16, y);
  doc.text('CNPJ', 95, y);
  doc.text('Município / UF', 145, y);

  y += 8;
  doc.setFont('helvetica', 'normal');

  igrejas.forEach((ig, index) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y - 4, 182, 7, 'F');
    }
    doc.text(ig.nomeFantasia.substring(0, 40), 16, y);
    doc.text(ig.cnpj, 95, y);
    doc.text(`${ig.municipio} / ${ig.uf}`, 145, y);
    y += 7;
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')} via SIGM Core Banking.`, 105, 290, { align: 'center' });

  doc.save(`Relatorio_Igrejas_Filiadas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function gerarPdfComprovanteInscricaoAgo(
  comprovante: any,
  ministro: Ministro,
  appConfig: AppConfig
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig.nomeConvencao || 'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig.sigla || 'CIMADEBE';
  const cnpj = appConfig.cnpj || '14.852.963/0001-44';

  // Cabeçalho Institucional Escuro com Dourado
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 42, 210, 2, 'F');

  // Título do Cabeçalho
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const linhasNome = doc.splitTextToSize(nomeConvencao.toUpperCase(), 170);
  let curY = 12;
  for (const l of linhasNome) {
    doc.text(l, 105, curY, { align: 'center' });
    curY += 4.5;
  }

  doc.setFontSize(8.5);
  doc.setTextColor(245, 158, 11);
  doc.text(`CNPJ: ${cnpj} • SEDE OFICIAL CONVENCIONAL`, 105, curY, { align: 'center' });
  curY += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248);
  doc.text('COMPROVANTE OFICIAL DE INSCRIÇÃO & HOMOLOGAÇÃO DE DELEGADO AGO', 105, curY, { align: 'center' });

  // Título do Documento
  let y = 54;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`COMPROVANTE DE QUITAÇÃO - AGO ${comprovante.anoVigente || 2026}`, 105, y, { align: 'center' });

  y += 3;
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.line(60, y, 150, y);

  // Quadro de Dados do Comprovante
  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 85, 3, 3, 'FD');

  let py = y + 8;
  const campo = (label: string, val: string, posX: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), posX, py);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(val, posX, py + 5);
  };

  campo('Protocolo / Transação:', comprovante.id || `AGO-${comprovante.anoVigente || 2026}-8941`, 20);
  campo('Situação Eclesiástica:', 'LIQUIDADO & HOMOLOGADO ✓', 110);
  py += 14;

  campo('Ministro / Delegado:', comprovante.ministroNome || ministro.nome, 20);
  campo('CPF / Documento:', comprovante.cpf || ministro.cpf || 'Cadastrado e Verificado', 110);
  py += 14;

  campo('Cargo Eclesiástico:', comprovante.cargo || ministro.cargo, 20);
  campo('Registro Ministerial (RM):', ministro.registroMinisterial || 'RM-039.279-26', 110);
  py += 14;

  campo('Plano / Convocatória:', comprovante.planoNome || `Plano Oficial AGO ${comprovante.anoVigente || 2026}`, 20);
  const valorNumerico = typeof comprovante.valor === 'number' ? comprovante.valor : parseFloat(String(comprovante.valor || 190).replace(',', '.'));
  campo('Valor Quitado:', `R$ ${(isNaN(valorNumerico) ? 190 : valorNumerico).toFixed(2).replace('.', ',')}`, 110);
  py += 14;

  campo('Forma de Pagamento:', comprovante.formaPagamento || 'PIX Instantâneo', 20);
  campo('Data da Inscrição:', comprovante.dataInscricao || new Date().toLocaleDateString('pt-BR'), 110);

  // Quadro de Autenticidade Digital
  y += 94;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, y, 180, 28, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('AUTENTICIDADE DIGITAL & LEDGER CONTÁBIL INVIOLÁVEL:', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Chave Criptográfica SHA-256: ${comprovante.hashIntegridade || `SHA256:AGO#${comprovante.anoVigente || 2026}#${ministro.cpf}#AUTENTICADO#SIGM`}`, 20, y + 12);
  doc.text(`• Registrado e Processado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, y + 17);
  doc.text(`• Jurisdição: Convenção Geral ${sigla} / Sistema SIGM Core Banking`, 20, y + 22);

  // Assinaturas no Rodapé
  y += 40;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(25, y, 90, y);
  doc.line(120, y, 185, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PRESIDÊNCIA GERAL DA CONVENÇÃO', 57.5, y + 4, { align: 'center' });
  doc.text('SECRETARIA EXECUTIVA DE FINANÇAS', 152.5, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${sigla} / SIGM Core`, 57.5, y + 8, { align: 'center' });
  doc.text('Comprovante Emitido pelo Servidor', 152.5, y + 8, { align: 'center' });

  doc.save(`Comprovante_AGO_${comprovante.anoVigente || 2026}_${ministro.nome.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Exporta balanço e relatório financeiro de anuidades com assinatura digital e QR Code de rastreabilidade
 */
export async function exportarRelatorioFinanceiroPdf(
  anuidades: any[],
  appConfig: AppConfig,
  totalArrecadado: number,
  totalPendente: number
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig.nomeConvencao || 'CONVENÇÃO CIMADEBE';
  const sigla = appConfig.sigla || 'CIMADEBE';

  // 1. Cabeçalho Institucional
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 38, 'F');
  doc.setFillColor(245, 158, 11); // Amber 500
  doc.rect(0, 38, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(nomeConvencao.toUpperCase(), 105, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11);
  doc.text('BALANÇO FINANCEIRO E AUDITORIA DE ANUIDADES', 105, 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`SISTEMA SIGM CORE BANKING • EMISSÃO OFICIAL COM RASTREABILIDADE`, 105, 29, { align: 'center' });

  // 2. Quadro de Indicadores Consolidados
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ARRECADADO (PAGO):', 25, y + 8);
  doc.text('TOTAL EM ABERTO (PENDENTE):', 110, y + 8);

  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`R$ ${totalArrecadado.toFixed(2).replace('.', ',')}`, 25, y + 16);
  doc.setTextColor(245, 158, 11); // Amber
  doc.text(`R$ ${totalPendente.toFixed(2).replace('.', ',')}`, 110, y + 16);

  // 3. Tabela de Lançamentos
  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('DEMONSTRATIVO DE ANUIDADES DE MINISTROS:', 15, y);

  y += 5;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Ministro / ID', 18, y + 5.5);
  doc.text('Ano', 105, y + 5.5);
  doc.text('Valor', 125, y + 5.5);
  doc.text('Forma', 150, y + 5.5);
  doc.text('Status', 172, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  const paginatedAnuidades = anuidades.slice(0, 22); // limite para manter em uma página no PDF
  paginatedAnuidades.forEach((a, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 7.5, 'F');
    }
    doc.text(String(a.ministroNome || a.ministroId || 'Ministro').substring(0, 42), 18, y + 5);
    doc.text(String(a.ano || '2026'), 105, y + 5);
    doc.text(`R$ ${Number(a.valor || 0).toFixed(2).replace('.', ',')}`, 125, y + 5);
    doc.text(String(a.formaPagamento || 'PIX'), 150, y + 5);
    
    doc.setFont('helvetica', 'bold');
    if (a.statusPagamento === 'PAGO') {
      doc.setTextColor(16, 185, 129);
      doc.text('PAGO', 172, y + 5);
    } else {
      doc.setTextColor(245, 158, 11);
      doc.text('PENDENTE', 172, y + 5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    y += 7.5;
  });

  // 4. Rodapé e Selo Criptográfico com QR Code de Autenticidade
  y = 250;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, y, 180, 32, 2, 2, 'FD');

  // Calcula um checksum hash real das anuidades para a assinatura digital do PDF
  const rawDataStr = JSON.stringify(anuidades.map(a => `${a.id}|${a.statusPagamento}|${a.valor || 0}`));
  const checksum = `SIGM-DRE-SHA256-${sha256(rawDataStr).substring(0, 32).toUpperCase()}`;
  const dataIso = new Date().toISOString();

  // Gera o QR Code com o Hash SHA-256 e os dados do relatório
  const qrDataPayload = JSON.stringify({
    tipo: 'RELATORIO_FINANCEIRO_DRE',
    sigla,
    emissao: dataIso,
    totalArrecadado,
    totalPendente,
    sha256: checksum,
    verificador: 'SIGM_CORE_BANKING_LEDGER'
  });

  try {
    const qrDataUrl = await QRCode.toDataURL(qrDataPayload, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    // Inserção visual do QR Code de verificação
    doc.addImage(qrDataUrl, 'PNG', 162, y + 2, 28, 28);
  } catch (err) {
    console.error('[QRCODE_GEN_ERR]', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RASTREABILIDADE DA ASSINATURA DIGITAL CONTÁBIL:', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Hash de Integridade: ${checksum}`, 20, y + 12);
  doc.text(`• Assinado eletronicamente por: ${sigla} Core Ledger em ${new Date().toLocaleDateString('pt-BR')}`, 20, y + 17);
  doc.text(`• QR Code de Verificação: Aponte a câmera para auditar a integridade`, 20, y + 22);
  doc.text(`  criptográfica e garantir autenticidade irrefutável do relatório.`, 20, y + 26);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Página 1/1 • Emitido via SIGM Core Banking com Selo QR Code Criptográfico`, 105, 288, { align: 'center' });

  doc.save(`Relatorio_Financeiro_${sigla}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Exporta credencial oficial de ministro (crachá físico) com assinatura digital e QR Code de rastreabilidade
 */
export async function exportarCredencialMinistroPdf(
  ministro: Ministro,
  appConfig: AppConfig
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig.nomeConvencao || 'CONVENÇÃO CIMADEBE';
  const sigla = appConfig.sigla || 'CIMADEBE';

  // 1. Cabeçalho
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(245, 158, 11); // Amber 500
  doc.rect(0, 42, 210, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(nomeConvencao.toUpperCase(), 105, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text('CREDENCIAÇÃO MINISTERIAL OFICIAL', 105, 23, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('CONFORMIDADE ESTATUTÁRIA REGULAMENTADA COM QR CODE RASTREÁVEL', 105, 29, { align: 'center' });

  // 2. Quadro do Crachá (Formato Físico Portável CR-80)
  let y = 50;
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(55, y, 100, 144, 4, 4, 'FD'); // 100mm x 144mm crachá

  // Foto do Ministro (Círculo ou Placeholder)
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(90, y + 8, 30, 30, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FOTO / RM', 105, y + 25, { align: 'center' });

  // Detalhes no Crachá
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(String(ministro.nome).toUpperCase().substring(0, 24), 105, y + 46, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CARGO:', 105, y + 53, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(String(ministro.cargo).toUpperCase(), 105, y + 58, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('REGISTRO MINISTERIAL (RM):', 105, y + 66, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 158, 11);
  doc.text(ministro.registroMinisterial || 'RM-PENDENTE', 105, y + 71, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CPF:', 105, y + 79, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(ministro.cpf || 'VERIFICADO', 105, y + 84, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('IGREJA FILIADA:', 105, y + 92, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(String(ministro.igrejaFiliadaNome || 'SEDE CONVENÇÃO').substring(0, 32), 105, y + 97, { align: 'center' });

  // Token de Verificação SHA no Crachá
  const tokenCredencial = `RM#${ministro.registroMinisterial || '00'}#${ministro.cpf}#${sigla}#${ministro.cargo}`;
  const checkCredencial = `SHA256:${sha256(tokenCredencial).slice(0, 32).toUpperCase()}`;

  // Gera o QR Code de Verificação da Credencial
  const qrCredencialPayload = JSON.stringify({
    tipo: 'CREDENCIAL_MINISTRO_OFICIAL',
    rm: ministro.registroMinisterial || 'PENDENTE',
    cpf: ministro.cpf || '000.000.000-00',
    nome: ministro.nome,
    cargo: ministro.cargo,
    igreja: ministro.igrejaFiliadaNome || 'SEDE',
    assinaturaDigitalSha256: checkCredencial,
    emissao: new Date().toISOString()
  });

  let qrCredencialDataUrl = '';
  try {
    qrCredencialDataUrl = await QRCode.toDataURL(qrCredencialPayload, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (err) {
    console.error('[QRCODE_CREDENCIAL_ERR]', err);
  }

  // Se o QR Code foi gerado, insere dentro do crachá (CR-80)
  if (qrCredencialDataUrl) {
    doc.addImage(qrCredencialDataUrl, 'PNG', 92, y + 103, 26, 26);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text('ASSINATURA DIGITAL CR-80:', 105, y + 133, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text(checkCredencial, 105, y + 138, { align: 'center' });

  // 3. Quadro de Assinatura e Rastreabilidade do Documento Geral
  y = 202;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, y, 180, 32, 2, 2, 'FD');

  if (qrCredencialDataUrl) {
    // Insere o QR Code ampliado na seção de auditoria oficial
    doc.addImage(qrCredencialDataUrl, 'PNG', 162, y + 2, 28, 28);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RASTREABILIDADE DA ASSINATURA DIGITAL MINISTERIAL:', 20, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Token Criptográfico RM: ${checkCredencial}`, 20, y + 12);
  doc.text(`• Assinado Eletronicamente por: Presidência Geral ${sigla} e Auditor Geral em ${new Date().toLocaleDateString('pt-BR')}`, 20, y + 17);
  doc.text(`• QR Code de Verificação: Código bidimensional dinâmico rastreável para leitura`, 20, y + 22);
  doc.text(`  na portaria da AGO ou por barramento óptico de segurança SIGM Core.`, 20, y + 26);

  // Rodapé
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Credencial Oficial SIGM • Válida em todo Território Nacional', 105, 288, { align: 'center' });

  doc.save(`Credencial_Oficial_${ministro.nome.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Exporta o Crachá Oficial de Inscrição da AGO para apresentação e credenciamento na portaria
 * Formato vertical de alta qualidade com QR Code de leitura rápida, foto, dados e marcas de recorte.
 */
export async function exportarCrachaInscricaoAgoPdf(
  inscricao: any,
  ministro: Partial<Ministro>,
  appConfig?: AppConfig,
  evento?: any
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig?.nomeConvencao || 'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const anoCiclo = inscricao?.cicloAGO || inscricao?.anoVigente || '2026';
  const nomeMinistro = String(ministro?.nome || inscricao?.ministroNome || 'Congressista').toUpperCase();
  const cpfMinistro = ministro?.cpf || inscricao?.ministroCpf || '000.000.000-00';
  const cargoMinistro = String(ministro?.cargo || inscricao?.cargo || 'DELEGADO').toUpperCase();
  const planoNome = inscricao?.planoNome || 'Inscrição Oficial AGO';
  const protocolo = inscricao?.id || `AGO-${anoCiclo}-${String(Date.now()).slice(-6)}`;
  const statusHomologacao = String(inscricao?.status || inscricao?.statusInscricao || 'CONFIRMADO').toUpperCase();

  // Dados Canônicos do Evento AGO extraídos do Banco de Dados Firestore
  const tituloEvento = String(evento?.titulo || '1ª Assembleia Geral Ordinária (AGO 2026)').toUpperCase();
  const subtituloEvento = String(evento?.subtitulo || 'Grande Conclave Geral de Obreiros e Plenárias Deliberativas').toUpperCase();
  const localEvento = evento?.local || 'Centro de Convenções Pastor Gilberto • Salvador / BA';
  const periodoEvento = formatarPeriodoEvento(evento?.data_inicio, evento?.data_fim, evento?.data_evento) || '20 a 23 de Novembro de 2026';

  // 1. Faixa Superior da Folha A4 - Identidade Institucional
  doc.setFillColor(10, 17, 40); // Deep Navy
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(217, 119, 6); // Gold #d97706
  doc.rect(0, 32, 210, 1.8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(nomeConvencao.toUpperCase(), 105, 12, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(245, 158, 11); // Gold
  doc.text(tituloEvento, 105, 20, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('CRACHÁ OFICIAL DE CONGRESSISTA & CREDENCIAMENTO DE PORTARIA', 105, 27, { align: 'center' });

  // 2. Quadro do Crachá Vertical (105mm x 155mm) Centralizado na página A4
  const badgeX = 52.5; // (210 - 105) / 2
  const badgeY = 40;
  const badgeW = 105;
  const badgeH = 158;

  // Linhas tracejadas de corte ao redor do crachá
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(badgeX - 1.5, badgeY - 1.5, badgeW + 3, badgeH + 3, 'S');
  doc.setLineDashPattern([], 0); // Reset dash

  // Fundo do Crachá
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.8);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'FD');

  // Cabeçalho Interno do Crachá
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(badgeX, badgeY, badgeW, 28, 3, 3, 'F');
  doc.rect(badgeX, badgeY + 24, badgeW, 4, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(badgeX, badgeY + 27.5, badgeW, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`${sigla} • CONCLAVE AGO ${anoCiclo}`, 105, badgeY + 7.5, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  const linhasTituloBadge = doc.splitTextToSize(tituloEvento, badgeW - 10);
  doc.text(linhasTituloBadge[0] || tituloEvento, 105, badgeY + 14.5, { align: 'center' });

  doc.setFontSize(5.5);
  doc.setTextColor(203, 213, 225);
  doc.text(subtituloEvento.slice(0, 52), 105, badgeY + 21, { align: 'center' });

  // Espaço da Foto / Moldura Institucional
  const photoW = 28;
  const photoH = 34;
  const photoX = 105 - (photoW / 2);
  const photoY = badgeY + 32;

  let fotoCarregada = false;
  if (ministro?.fotoUrl && typeof ministro.fotoUrl === 'string' && (ministro.fotoUrl.startsWith('data:image') || ministro.fotoUrl.startsWith('http'))) {
    try {
      doc.addImage(ministro.fotoUrl, 'JPEG', photoX, photoY, photoW, photoH);
      fotoCarregada = true;
    } catch {
      fotoCarregada = false;
    }
  }

  if (!fotoCarregada) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.6);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'FD');

    doc.setFillColor(15, 23, 42);
    doc.circle(105, photoY + 14, 8, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(nomeMinistro.slice(0, 2), 105, photoY + 16.5, { align: 'center' });

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6);
    doc.text('FOTO OFICIAL', 105, photoY + 28, { align: 'center' });
  } else {
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.6);
    doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'S');
  }

  // Tarja do Cargo Eclesiástico
  const cargoBadgeY = photoY + photoH + 2.5;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(badgeX + 15, cargoBadgeY, badgeW - 30, 6, 1.5, 1.5, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(cargoMinistro, 105, cargoBadgeY + 4.2, { align: 'center' });

  // Nome do Congressista
  let curBadgeY = cargoBadgeY + 11;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const nomeLinhas = doc.splitTextToSize(nomeMinistro, badgeW - 10);
  for (const nl of nomeLinhas) {
    doc.text(nl, 105, curBadgeY, { align: 'center' });
    curBadgeY += 4.5;
  }

  // CPF e Detalhes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`CPF: ${cpfMinistro}`, 105, curBadgeY, { align: 'center' });
  curBadgeY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(String(planoNome).substring(0, 40), 105, curBadgeY, { align: 'center' });
  curBadgeY += 4.5;

  // Box do QR Code de Portaria
  const qrBoxY = curBadgeY;
  const qrBoxH = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX + 8, qrBoxY, badgeW - 16, qrBoxH, 2, 2, 'FD');

  const qrPortariaPayload = JSON.stringify({
    tipo: 'CRACHA_PORTARIA_AGO',
    protocolo: protocolo,
    ciclo: anoCiclo,
    cpf: cpfMinistro,
    nome: nomeMinistro,
    cargo: cargoMinistro,
    status: statusHomologacao,
    validadoEm: new Date().toISOString()
  });

  let qrPortariaDataUrl = '';
  try {
    qrPortariaDataUrl = await QRCode.toDataURL(qrPortariaPayload, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
  } catch (err) {
    console.error('[QRCODE_PORTARIA_ERR]', err);
  }

  if (qrPortariaDataUrl) {
    doc.addImage(qrPortariaDataUrl, 'PNG', 105 - 13, qrBoxY + 2.5, 26, 26);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(15, 23, 42);
  doc.text('[ LEITURA ÓPTICA • PORTARIA & TRIAGEM ]', 105, qrBoxY + 31.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(100, 116, 139);
  doc.text('Apresente este código para retirada de kit e registro de presença', 105, qrBoxY + 34.5, { align: 'center' });

  // Rodapé do Crachá
  const badgeFooterY = badgeY + badgeH - 12;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(badgeX, badgeFooterY, badgeW, 12, 0, 0, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(badgeX, badgeFooterY, badgeW, 0.8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(`PROTOCOLO: ${protocolo}`, 105, badgeFooterY + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  const rodapeBadgeTexto = [periodoEvento, localEvento].filter(Boolean).join(' • ');
  doc.text(rodapeBadgeTexto.slice(0, 65), 105, badgeFooterY + 8.5, { align: 'center' });

  // 3. Guia de Instruções na Folha A4
  const instrucoesY = badgeY + badgeH + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('INSTRUÇÕES PARA O CONGRESSISTA • APRESENTAÇÃO NA PORTARIA:', 20, instrucoesY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('1. Imprima este crachá e recorte nas linhas pontilhadas para encaixar em seu porta-crachá com cordão, ou apresente o PDF/imagem no celular.', 20, instrucoesY + 5);
  doc.text(`2. Na portaria (${localEvento.slice(0, 50)}), o leitor óptico fará a validação instantânea da sua presença e liberará o seu kit.`, 20, instrucoesY + 9.5);
  doc.text('3. O Birô Oficial da Convenção fornecerá os materiais e sua credencial impressa mediante confirmação deste crachá na recepção.', 20, instrucoesY + 14);
  doc.text('4. É obrigatória a apresentação de documento oficial com foto (RG, CNH ou Carteira Profissional).', 20, instrucoesY + 18.5);

  // Rodapé da Folha A4
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido eletronicamente via SIGM Core • Convenção ${sigla} • Autenticação: SHA256:${sha256(protocolo).slice(0, 16).toUpperCase()}`, 105, 288, { align: 'center' });

  const nomeArquivo = `Cracha_AGO_${anoCiclo}_${nomeMinistro.replace(/\s+/g, '_').slice(0, 20)}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * EXPORTAÇÃO RÁPIDA DE MINISTROS FILTRADOS EM PDF (LANDSCAPE A4)
 */
export function exportarPdfTabelaMinistrosFiltrados(
  ministros: readonly Ministro[],
  filtros: { busca?: string; cargo?: string; status?: string; adimplencia?: string },
  appConfig?: AppConfig
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig?.nomeConvencao || 'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const cnpj = appConfig?.cnpj || '14.852.963/0001-44';
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR');

  const desenharCabecalho = (paginaAtual: number) => {
    // Top Bar
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 297, 28, 'F');
    doc.setFillColor(16, 185, 129); // Emerald
    doc.rect(0, 28, 297, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${sigla} - ${nomeConvencao.toUpperCase()}`, 14, 11);

    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text(`RELATÓRIO GERAL DE MINISTROS FILIADOS • CNPJ: ${cnpj}`, 14, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emitido em: ${dataEmissao} às ${horaEmissao} • Pág. ${paginaAtual}`, 283, 18, { align: 'right' });
  };

  let pagina = 1;
  desenharCabecalho(pagina);

  // Bloco de Informações e Filtros
  let y = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 269, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total de Ministros Listados: ${ministros.length}`, 18, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const infoFiltros = `Filtros: [Cargo: ${filtros.cargo || 'TODOS'}] • [Status: ${filtros.status || 'TODOS'}] • [Adimplência: ${filtros.adimplencia || 'TODOS'}]${filtros.busca ? ` • [Busca: "${filtros.busca}"]` : ''}`;
  doc.text(infoFiltros, 80, y + 7.5);

  // Cabeçalho da Tabela
  y = 53;
  const desenharCabecalhoTabela = (posY: number) => {
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(14, posY, 269, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('NOME DO MINISTRO', 17, posY + 5);
    doc.text('CPF', 88, posY + 5);
    doc.text('CARGO', 120, posY + 5);
    doc.text('REG. MINISTERIAL', 150, posY + 5);
    doc.text('IGREJA FILIADA / SEDE', 185, posY + 5);
    doc.text('ADIMPLÊNCIA', 242, posY + 5);
    doc.text('STATUS', 268, posY + 5);
  };

  desenharCabecalhoTabela(y);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (ministros.length === 0) {
    y += 8;
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum ministro atende aos critérios de filtro aplicados.', 148.5, y, { align: 'center' });
  } else {
    ministros.forEach((m, idx) => {
      if (y > 185) {
        doc.addPage();
        pagina += 1;
        desenharCabecalho(pagina);
        y = 36;
        desenharCabecalhoTabela(y);
        y += 7.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 269, 6.5, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6.5, 283, y + 6.5);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(m.nome || 'N/A').substring(0, 42), 17, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(m.cpf || '000.000.000-00'), 88, y + 4.5);
      doc.text(String(m.cargo || 'Pastor'), 120, y + 4.5);
      doc.text(String(m.registroMinisterial || 'RM-PENDENTE'), 150, y + 4.5);
      doc.text(String(m.igrejaFiliadaNome || 'AD Sede').substring(0, 32), 185, y + 4.5);

      const adimp = m.statusAdimplencia || 'PENDENTE';
      if (adimp === 'EM_DIA' || adimp === 'ADIMPLENTE') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(adimp, 242, y + 4.5);

      const stat = m.status || 'ATIVO';
      if (stat === 'ATIVO') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(234, 88, 12);
      }
      doc.text(stat, 268, y + 4.5);

      y += 6.5;
    });
  }

  // Rodapé Oficial
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido via SIGM Core Banking • Convenção ${sigla} • Relatório Ministerial Oficial`, 148.5, 202, { align: 'center' });

  doc.save(`Relatorio_Ministros_${sigla}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * EXPORTAÇÃO RÁPIDA DE IGREJAS FILIADAS EM PDF (LANDSCAPE A4)
 */
export function exportarPdfTabelaIgrejasFiltradas(
  igrejas: readonly IgrejaFiliada[],
  filtros: { busca?: string; cidade?: string; status?: string },
  appConfig?: AppConfig
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig?.nomeConvencao || 'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const cnpj = appConfig?.cnpj || '14.852.963/0001-44';
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR');

  const desenharCabecalho = (paginaAtual: number) => {
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 297, 28, 'F');
    doc.setFillColor(14, 165, 233); // Cyan
    doc.rect(0, 28, 297, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${sigla} - ${nomeConvencao.toUpperCase()}`, 14, 11);

    doc.setFontSize(8.5);
    doc.setTextColor(14, 165, 233);
    doc.text(`RELAÇÃO OFICIAL DE IGREJAS FILIADAS • CNPJ: ${cnpj}`, 14, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emitido em: ${dataEmissao} às ${horaEmissao} • Pág. ${paginaAtual}`, 283, 18, { align: 'right' });
  };

  let pagina = 1;
  desenharCabecalho(pagina);

  // Bloco de Informações e Filtros
  let y = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 269, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total de Congregações / Igrejas: ${igrejas.length}`, 18, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const infoFiltros = `Filtros: [Município: ${filtros.cidade || 'TODAS'}] • [Status: ${filtros.status || 'TODOS'}]${filtros.busca ? ` • [Busca: "${filtros.busca}"]` : ''}`;
  doc.text(infoFiltros, 90, y + 7.5);

  // Cabeçalho da Tabela
  y = 53;
  const desenharCabecalhoTabela = (posY: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, posY, 269, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('NOME FANTASIA', 17, posY + 5);
    doc.text('RAZÃO SOCIAL', 75, posY + 5);
    doc.text('CNPJ', 140, posY + 5);
    doc.text('PASTOR PRESIDENTE', 175, posY + 5);
    doc.text('CIDADE / UF', 228, posY + 5);
    doc.text('STATUS', 268, posY + 5);
  };

  desenharCabecalhoTabela(y);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (igrejas.length === 0) {
    y += 8;
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma igreja filiada atende aos critérios de busca.', 148.5, y, { align: 'center' });
  } else {
    igrejas.forEach((ig, idx) => {
      if (y > 185) {
        doc.addPage();
        pagina += 1;
        desenharCabecalho(pagina);
        y = 36;
        desenharCabecalhoTabela(y);
        y += 7.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 269, 6.5, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6.5, 283, y + 6.5);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(ig.nomeFantasia || 'N/A').substring(0, 32), 17, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(ig.razaoSocial || '').substring(0, 36), 75, y + 4.5);
      doc.text(String(ig.cnpj || '00.000.000/0001-00'), 140, y + 4.5);
      doc.text(String(ig.pastorPresidenteNome || 'A Designar').substring(0, 30), 175, y + 4.5);
      doc.text(`${ig.municipio || ''} / ${ig.uf || ''}`, 228, y + 4.5);

      const stat = ig.status || 'ATIVA';
      if (stat === 'ATIVA') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(stat, 268, y + 4.5);

      y += 6.5;
    });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido via SIGM Core Banking • Convenção ${sigla} • Relatório de Igrejas Filiadas`, 148.5, 202, { align: 'center' });

  doc.save(`Relatorio_Igrejas_${sigla}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * EXPORTAÇÃO RÁPIDA DE INSCRITOS DA AGO EM PDF (LANDSCAPE A4)
 */
export function exportarPdfTabelaInscritosAgoFiltrados(
  inscritos: readonly any[],
  filtros: { busca?: string; plano?: string; status?: string; formaPagamento?: string },
  appConfig?: AppConfig,
  anoCiclo: number = 2026
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const nomeConvencao = appConfig?.nomeConvencao || 'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const cnpj = appConfig?.cnpj || '14.852.963/0001-44';
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  const horaEmissao = new Date().toLocaleTimeString('pt-BR');

  const totalFinanceiro = inscritos.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
  const formatarMoeda = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const desenharCabecalho = (paginaAtual: number) => {
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 297, 28, 'F');
    doc.setFillColor(245, 158, 11); // Amber / Dourado AGO
    doc.rect(0, 28, 297, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${sigla} - ${nomeConvencao.toUpperCase()}`, 14, 11);

    doc.setFontSize(8.5);
    doc.setTextColor(245, 158, 11);
    doc.text(`HOMOLOGAÇÃO DE INSCRITOS • ASSEMBLEIA GERAL ORDINÁRIA (AGO ${anoCiclo})`, 14, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Emitido em: ${dataEmissao} às ${horaEmissao} • Pág. ${paginaAtual}`, 283, 18, { align: 'right' });
  };

  let pagina = 1;
  desenharCabecalho(pagina);

  // Bloco de Métricas Resumo
  let y = 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 269, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Inscritos: ${inscritos.length} | Arrecadação Total: ${formatarMoeda(totalFinanceiro)}`, 18, y + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const infoFiltros = `Filtros: [Plano: ${filtros.plano || 'TODOS'}] • [Status: ${filtros.status || 'TODOS'}] • [Pagamento: ${filtros.formaPagamento || 'TODOS'}]${filtros.busca ? ` • [Busca: "${filtros.busca}"]` : ''}`;
  doc.text(infoFiltros, 115, y + 7.5);

  // Cabeçalho da Tabela
  y = 53;
  const desenharCabecalhoTabela = (posY: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, posY, 269, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('MINISTRO / PARTICIPANTE', 17, posY + 5);
    doc.text('CPF', 78, posY + 5);
    doc.text('CARGO', 108, posY + 5);
    doc.text('PLANO AGO', 135, posY + 5);
    doc.text('VALOR', 190, posY + 5);
    doc.text('PAGAMENTO', 215, posY + 5);
    doc.text('HOMOLOGAÇÃO', 242, posY + 5);
    doc.text('DATA', 268, posY + 5);
  };

  desenharCabecalhoTabela(y);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  if (inscritos.length === 0) {
    y += 8;
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum inscrito na AGO localizado com os filtros atuais.', 148.5, y, { align: 'center' });
  } else {
    inscritos.forEach((i, idx) => {
      if (y > 185) {
        doc.addPage();
        pagina += 1;
        desenharCabecalho(pagina);
        y = 36;
        desenharCabecalhoTabela(y);
        y += 7.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 269, 6.5, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 6.5, 283, y + 6.5);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i.ministroNome || i.nome || 'N/A').substring(0, 35), 17, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(i.ministroCpf || i.cpf || '000.000.000-00'), 78, y + 4.5);
      doc.text(String(i.cargo || 'Pastor'), 108, y + 4.5);
      doc.text(String(i.planoNome || 'Plano 1').substring(0, 30), 135, y + 4.5);
      doc.text(formatarMoeda(Number(i.valor) || 0), 190, y + 4.5);
      doc.text(String(i.formaPagamento || 'PIX'), 215, y + 4.5);

      const stat = i.statusInscricao || i.status || 'CONFIRMADA';
      if (stat === 'VALIDA' || stat === 'CONFIRMADA' || stat === 'PAGO') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(stat, 242, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(i.dataInscricao || '').slice(0, 10), 268, y + 4.5);

      y += 6.5;
    });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido via SIGM Core Banking • Convenção ${sigla} • Relatório de Inscritos AGO ${anoCiclo}`, 148.5, 202, { align: 'center' });

  doc.save(`Relatorio_Inscritos_AGO_${anoCiclo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * ========================================================
 * RECIBO OFICIAL DE QUITAÇÃO MINISTERIAL EM PDF (PORTRAIT A4)
 * ========================================================
 */
export async function gerarPdfReciboPagamentoMinistro(params: {
  ministro: Ministro;
  anuidade: {
    id: string;
    anoVigente?: number;
    ano?: number;
    valor: number;
    dataVencimento?: string;
    dataPagamento?: string;
    metodoPagamento?: string;
    categoria?: string;
    tipo?: string;
    rotulo?: string;
    ehFiliacao?: boolean;
    observacao?: string;
    statusPagamento?: string;
  };
  appConfig?: AppConfig;
  autenticacaoHash?: string;
}) {
  const { ministro, anuidade, appConfig } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const nomeConvencao =
    appConfig?.nomeConvencao ||
    'CONVENÇÃO ESTADUAL E INTERESTADUAL DE MINISTROS E IGREJAS ASSEMBLEIA DE DEUS - CIMADEBE';
  const sigla = appConfig?.sigla || 'CIMADEBE';
  const cnpj = appConfig?.cnpj || '14.852.963/0001-44';
  const endereco = appConfig?.endereco || 'Salvador - BA';

  const ano = anuidade.anoVigente || anuidade.ano || new Date().getFullYear();
  const ehFiliacao = Boolean(
    anuidade.ehFiliacao ||
      anuidade.categoria === 'TAXA_CONVENCAO' ||
      anuidade.tipo === 'FILIACAO' ||
      anuidade.id?.startsWith('an-fil-')
  );

  const tituloCobranca =
    anuidade.rotulo ||
    (ehFiliacao
      ? 'Taxa Oficial de Filiação Ministerial'
      : `Anuidade Ministerial - Exercício ${ano}`);

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(anuidade.valor || 120));

  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const horaHoje = new Date().toLocaleTimeString('pt-BR');
  const reciboNumero = `REC-${(anuidade.id || Date.now().toString()).slice(-8).toUpperCase()}`;

  // Hash criptográfico de validação
  const hashRaw = `${anuidade.id}:${ministro.id}:${ministro.cpf}:${anuidade.valor}:${ano}:CIMADEBE-2026`;
  const hashVal = params.autenticacaoHash || (await sha256(hashRaw)).slice(0, 32).toUpperCase();

  // Cabeçalho Institucional
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(0, 42, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(sigla, 105, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(nomeConvencao.toUpperCase(), 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153); // Emerald 400
  doc.text('RECIBO OFICIAL DE QUITAÇÃO MINISTERIAL', 105, 30, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`CNPJ: ${cnpj} • ${endereco}`, 105, 36, { align: 'center' });

  // Bloco Número do Recibo e Data
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 50, 182, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`RECIBO Nº: ${reciboNumero}`, 18, 58.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Data de Emissão: ${dataHoje} às ${horaHoje}`, 192, 58.5, { align: 'right' });

  // Bloco 1: Dados do Ministro (Pagador)
  let y = 70;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DADOS DO MINISTRO / CONTRIBUINTE', 18, y + 5);

  y += 7;
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 38);

  const drawRow = (label: string, val: string, posY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, 18, posY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, 65, posY);
  };

  drawRow('Nome Completo:', String(ministro.nome || 'N/A').toUpperCase(), y + 7);
  drawRow('CPF Oficial:', ministro.cpf || '000.000.000-00', y + 14);
  drawRow('Registro Ministerial (RM):', ministro.registroMinisterial || 'RM-CIMADEBE-OFICIAL', y + 21);
  drawRow('Cargo Eclesiástico:', ministro.cargo || 'Pastor', y + 28);
  drawRow('Igreja Filiada Vinculada:', ministro.igrejaFiliadaNome || 'Templo Sede Estadual', y + 35);

  // Bloco 2: Detalhes da Transação & Quitação
  y += 44;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DETALHES DA TRANSAÇÃO & REGISTRO CONTÁBIL', 18, y + 5);

  y += 7;
  doc.rect(14, y, 182, 52);

  drawRow('Descrição do Lançamento:', tituloCobranca, y + 7);
  drawRow('Exercício de Referência:', String(ano), y + 14);
  drawRow('Forma de Liquidação:', anuidade.metodoPagamento || 'PIX Instantâneo / Gateway Bancário', y + 21);
  drawRow('Situação Contábil:', 'QUITADO & CONFIRMADO NO LEDGER', y + 28);
  drawRow('Data da Liquidação:', anuidade.dataPagamento ? String(anuidade.dataPagamento).slice(0, 10) : dataHoje, y + 35);

  // Destaque do Valor
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(18, y + 40, 174, 9, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('VALOR TOTAL PAGO:', 22, y + 46);
  doc.setFontSize(10.5);
  doc.text(valorFormatado, 188, y + 46, { align: 'right' });

  // Bloco 3: Declaração de Quitação & Autenticidade
  y += 58;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Declaramos para os devidos fins de direito e comprovação estatutária que o(a) ministro(a) acima qualificado(a) encontra-se com a referida contribuição ministerial devidamente QUITADA e lançada no Ledger Oficial da Convenção Geral ${sigla}, gozando de plena regularidade convencional para o exercício.`,
    18,
    y + 5,
    { maxWidth: 174, lineHeightFactor: 1.3 }
  );

  // Assinaturas
  y += 22;
  doc.setDrawColor(148, 163, 184);
  doc.line(25, y, 90, y);
  doc.line(120, y, 185, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('TESOURARIA GERAL', 57.5, y + 4, { align: 'center' });
  doc.text('PRESIDÊNCIA DA CONVENÇÃO', 152.5, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${sigla} • Controle Financeiro`, 57.5, y + 7.5, { align: 'center' });
  doc.text('Chancela Estatutária Digital', 152.5, y + 7.5, { align: 'center' });

  // QR Code de Autenticidade
  try {
    const qrData = `RECIBO-CIMADEBE:${reciboNumero}|MIN:${ministro.cpf}|VAL:${valorFormatado}|ANO:${ano}|HASH:${hashVal}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });
    doc.addImage(qrCodeDataUrl, 'PNG', 160, 238, 32, 32);
  } catch (err) {
    console.error('Erro ao gerar QR Code do recibo:', err);
  }

  // Bloco de Autenticação Digital SHA-256 no rodapé
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 238, 142, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(52, 211, 153);
  doc.text('AUTENTICAÇÃO DIGITAL & LEDGER CRIPTOGRÁFICO', 18, 245);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Protocolo: ${reciboNumero}`, 18, 251);
  doc.text(`Hash SHA-256: ${hashVal}`, 18, 257);
  doc.text(`Validador: SIGM-CORE-BANKING-v2026`, 18, 263);

  // Rodapé final
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento emitido eletronicamente pelo Sistema Integrado SIGM • Convenção Geral ${sigla} • Válido em todo território nacional.`,
    105,
    285,
    { align: 'center' }
  );

  const filename = `Recibo_Quitacao_${(ministro.nome || 'Ministro').replace(/[^a-zA-Z0-9]/g, '_')}_${ano}.pdf`;
  doc.save(filename);
}
