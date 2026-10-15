-- ============================================================================
-- CIMADEBE / SIGM - SISTEMA INTEGRADO DE GOVERNANÇA E MINISTROS
-- SCRIPT DE DEFINIÇÃO DE BANCO DE DADOS RELACIONAL (POSTGRESQL / CLOUD SQL / SUPABASE)
-- NÍVEL BANCÁRIO DE CONFIABILIDADE, ISOLAMENTO MULTI-TENANT E AUDITORIA CRIPTOGRÁFICA
-- ============================================================================

-- Habilitação de extensões para geração de UUID e funções criptográficas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA: tenants (Entidades Jurídicas / Convenções Regionais e Sede)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    chave_sede BOOLEAN NOT NULL DEFAULT FALSE,
    endereco TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA: ministros (Cadastro Geral de Obreiros e Líderes Eclesiásticos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ministros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    status_adimplencia TEXT NOT NULL DEFAULT 'PENDENTE',
    cep VARCHAR(9) NOT NULL,
    endereco TEXT NOT NULL,
    bairro TEXT NOT NULL,
    cidade TEXT NOT NULL,
    uf VARCHAR(2) NOT NULL,
    data_filiacao DATE NOT NULL DEFAULT CURRENT_DATE,
    foto_url TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status_ministro CHECK (status IN ('ATIVO', 'SUSPENSO', 'EM_ANALISE')),
    CONSTRAINT chk_adimplencia_ministro CHECK (status_adimplencia IN ('ADIMPLENTE', 'PENDENTE', 'INADIMPLENTE'))
);

-- ============================================================================
-- 3. TABELA: anuidades (Lançamentos Contábeis de Anuidades e Taxas de Filiação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS anuidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ministro_id UUID NOT NULL REFERENCES ministros(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ano_vigente INT NOT NULL,
    data_vencimento DATE NOT NULL,
    valor NUMERIC(12, 2) NOT NULL CHECK (valor >= 0),
    status_pagamento TEXT NOT NULL DEFAULT 'ABERTO',
    tipo TEXT NOT NULL DEFAULT 'RECEITA',
    categoria TEXT NOT NULL DEFAULT 'ANUIDADE',
    asaas_payment_id TEXT,
    data_confirmacao_pagamento TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status_pagamento CHECK (status_pagamento IN ('PAGO', 'ABERTO')),
    CONSTRAINT chk_categoria_transacao CHECK (categoria IN ('TAXA_CONVENCAO', 'ANUIDADE'))
);

-- ============================================================================
-- 4. TABELA: inscricoes_ago (Inscrições na Assembleia Geral Ordinária)
-- TRAVA DE UNICIDADE VIA BANCO: Combinação de cpf + ano_vigente + status_inscricao
-- ============================================================================
CREATE TABLE IF NOT EXISTS inscricoes_ago (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ministro_id UUID NOT NULL REFERENCES ministros(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    cpf VARCHAR(14) NOT NULL,
    ano_vigente INT NOT NULL,
    status_inscricao TEXT NOT NULL DEFAULT 'VALIDA',
    data_inscricao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo_revogacao TEXT,
    data_revogacao TIMESTAMPTZ,
    CONSTRAINT chk_status_inscricao CHECK (status_inscricao IN ('VALIDA', 'REVOGADA')),
    -- Trava Financeira de Unicidade Compulsória no Banco de Dados
    CONSTRAINT uq_inscricao_ago_cpf_ano_status UNIQUE (cpf, ano_vigente, status_inscricao)
);

-- Índice único parcial adicional: Proíbe estritamente duas inscrições com status VALIDA para o mesmo CPF no mesmo ano
CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_ago_cpf_ano_valida 
ON inscricoes_ago (cpf, ano_vigente) 
WHERE status_inscricao = 'VALIDA';

-- ============================================================================
-- 5. TABELA: audit_logs (Cadeia de Custódia Imutável - Append-Only Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operador_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    payload_str TEXT NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    ip_sessao TEXT NOT NULL DEFAULT '127.0.0.1'
);

-- ============================================================================
-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ministros_tenant_id ON ministros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ministros_cpf ON ministros(cpf);
CREATE INDEX IF NOT EXISTS idx_ministros_adimplencia ON ministros(status_adimplencia);
CREATE INDEX IF NOT EXISTS idx_anuidades_ministro_id ON anuidades(ministro_id);
CREATE INDEX IF NOT EXISTS idx_anuidades_tenant_id ON anuidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anuidades_status_pagamento ON anuidades(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_inscricoes_ago_tenant_id ON inscricoes_ago(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_ago_ano_vigente ON inscricoes_ago(ano_vigente);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON audit_logs(payload_hash);

-- ============================================================================
-- SEGURANÇA BANCÁRIA: ROW LEVEL SECURITY (RLS) FORÇADO NATIVAMENTE
-- ============================================================================

-- Ativação compulsória do RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE ministros ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministros FORCE ROW LEVEL SECURITY;

ALTER TABLE anuidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuidades FORCE ROW LEVEL SECURITY;

ALTER TABLE inscricoes_ago ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscricoes_ago FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Função Auxiliar Segura para Obter o Tenant da Sessão do Usuário
-- Compatível com Supabase Auth (auth.jwt()) e Cloud SQL (current_setting)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    jwt_tenant TEXT;
    app_tenant TEXT;
BEGIN
    -- Tentativa 1: JWT emitido pelo Supabase Auth
    BEGIN
        jwt_tenant := current_setting('request.jwt.claims', true)::json->>'tenant_id';
        IF jwt_tenant IS NOT NULL AND jwt_tenant <> '' THEN
            RETURN jwt_tenant::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Prossegue para próxima checagem
    END;

    -- Tentativa 2: Parâmetro customizado de conexão PostgreSQL
    BEGIN
        app_tenant := current_setting('app.current_tenant_id', true);
        IF app_tenant IS NOT NULL AND app_tenant <> '' THEN
            RETURN app_tenant::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Prossegue caso não esteja configurado
    END;

    -- Retorna nulo se não houver contexto de tenant configurado
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS: TABELA 'tenants'
-- Usuário só pode ler seu próprio tenant ou se for sede central
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_tenants_isolation ON tenants;
CREATE POLICY p_tenants_isolation ON tenants
    FOR SELECT
    USING (
        id = get_current_tenant_id() 
        OR (SELECT chave_sede FROM tenants WHERE id = get_current_tenant_id()) = TRUE
    );

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS: TABELA 'ministros'
-- Isolamento absoluto: CONG_NORTE jamais visualiza nem altera CONG_SUL
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_ministros_isolation_select ON ministros;
CREATE POLICY p_ministros_isolation_select ON ministros
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_ministros_isolation_insert ON ministros;
CREATE POLICY p_ministros_isolation_insert ON ministros
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_ministros_isolation_update ON ministros;
CREATE POLICY p_ministros_isolation_update ON ministros
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_ministros_isolation_delete ON ministros;
CREATE POLICY p_ministros_isolation_delete ON ministros
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS: TABELA 'anuidades'
-- Isolamento de lançamentos financeiros
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_anuidades_isolation_select ON anuidades;
CREATE POLICY p_anuidades_isolation_select ON anuidades
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_anuidades_isolation_insert ON anuidades;
CREATE POLICY p_anuidades_isolation_insert ON anuidades
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_anuidades_isolation_update ON anuidades;
CREATE POLICY p_anuidades_isolation_update ON anuidades
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS: TABELA 'inscricoes_ago'
-- Isolamento de inscrições por convenção/tenant
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_inscricoes_ago_isolation_select ON inscricoes_ago;
CREATE POLICY p_inscricoes_ago_isolation_select ON inscricoes_ago
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_inscricoes_ago_isolation_insert ON inscricoes_ago;
CREATE POLICY p_inscricoes_ago_isolation_insert ON inscricoes_ago
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_inscricoes_ago_isolation_update ON inscricoes_ago;
CREATE POLICY p_inscricoes_ago_isolation_update ON inscricoes_ago
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

-- ----------------------------------------------------------------------------
-- POLÍTICAS RLS: TABELA 'audit_logs'
-- APPEND-ONLY: Permite somente SELECT e INSERT no tenant ativo.
-- UPDATE e DELETE são bloqueados por omissão de política para garantir imutabilidade.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_audit_logs_isolation_select ON audit_logs;
CREATE POLICY p_audit_logs_isolation_select ON audit_logs
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_audit_logs_isolation_insert ON audit_logs;
CREATE POLICY p_audit_logs_isolation_insert ON audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

-- ============================================================================
-- GATILHO AUTOMÁTICO: Recálculo de Adimplência do Ministro em Cascata
-- Quando uma anuidade é liquidada, recalcula o status do ministro automaticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_recalcular_adimplencia_ministro()
RETURNS TRIGGER AS $$
DECLARE
    v_tem_inadimplente BOOLEAN;
    v_tem_aberto BOOLEAN;
    v_data_corte DATE := '2026-09-26'::DATE; -- Data base contábil do ecossistema
BEGIN
    -- Verifica se o ministro possui qualquer anuidade vencida não paga
    SELECT EXISTS (
        SELECT 1 FROM anuidades 
        WHERE ministro_id = NEW.ministro_id 
          AND status_pagamento = 'ABERTO' 
          AND data_vencimento < v_data_corte
    ) INTO v_tem_inadimplente;

    IF v_tem_inadimplente THEN
        UPDATE ministros 
        SET status_adimplencia = 'INADIMPLENTE', atualizado_em = NOW() 
        WHERE id = NEW.ministro_id;
        RETURN NEW;
    END IF;

    -- Verifica se possui anuidade em aberto mas ainda dentro do prazo
    SELECT EXISTS (
        SELECT 1 FROM anuidades 
        WHERE ministro_id = NEW.ministro_id 
          AND status_pagamento = 'ABERTO' 
          AND data_vencimento >= v_data_corte
    ) INTO v_tem_aberto;

    IF v_tem_aberto THEN
        UPDATE ministros 
        SET status_adimplencia = 'PENDENTE', atualizado_em = NOW() 
        WHERE id = NEW.ministro_id;
    ELSE
        UPDATE ministros 
        SET status_adimplencia = 'ADIMPLENTE', atualizado_em = NOW() 
        WHERE id = NEW.ministro_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atualizar_adimplencia_anuidade ON anuidades;
CREATE TRIGGER trg_atualizar_adimplencia_anuidade
AFTER INSERT OR UPDATE OF status_pagamento ON anuidades
FOR EACH ROW
EXECUTE FUNCTION trg_recalcular_adimplencia_ministro();

-- ============================================================================
-- SEED DATA DE CONVENÇÕES E DEMONSTRAÇÃO
-- ============================================================================
INSERT INTO tenants (id, name, cnpj, chave_sede, endereco)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'CIMADEBE Sede Central Salvador', '14.852.963/0001-44', TRUE, 'Av. Sete de Setembro, 1500 - Campo Grande, Salvador - BA'),
    ('22222222-2222-2222-2222-222222222222', 'CIMADEBE Regional Feira de Santana', '25.963.741/0001-55', FALSE, 'Av. Getúlio Vargas, 2100 - Centro, Feira de Santana - BA'),
    ('33333333-3333-3333-3333-333333333333', 'CIMADEBE Regional Vitória da Conquista', '36.741.852/0001-66', FALSE, 'Av. Juracy Magalhães, 340 - Felícia, Vitória da Conquista - BA')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. TABELA: igrejas_filiadas (Cadastro de Igrejas Filiadas e Templos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS igrejas_filiadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    cnpj VARCHAR(18) NOT NULL UNIQUE,
    data_abertura DATE NOT NULL,
    natureza_juridica TEXT NOT NULL,
    cnae_principal TEXT NOT NULL,
    situacao_cadastral TEXT NOT NULL DEFAULT 'ATIVA',
    logradouro TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    bairro TEXT NOT NULL,
    municipio TEXT NOT NULL,
    uf VARCHAR(2) NOT NULL,
    cep VARCHAR(9) NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    pastor_presidente_id UUID REFERENCES ministros(id) ON DELETE SET NULL,
    pastor_presidente_nome TEXT NOT NULL,
    logo_url TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVA',
    data_filiacao DATE NOT NULL DEFAULT CURRENT_DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_situacao_cadastral_igreja CHECK (situacao_cadastral IN ('ATIVA', 'BAIXADA', 'SUSPENSA')),
    CONSTRAINT chk_status_igreja CHECK (status IN ('ATIVA', 'SUSPENSA'))
);

CREATE INDEX IF NOT EXISTS idx_igrejas_filiadas_tenant_id ON igrejas_filiadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_igrejas_filiadas_cnpj ON igrejas_filiadas(cnpj);
CREATE INDEX IF NOT EXISTS idx_igrejas_filiadas_municipio ON igrejas_filiadas(municipio);

ALTER TABLE igrejas_filiadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas_filiadas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_igrejas_filiadas_isolation_select ON igrejas_filiadas;
CREATE POLICY p_igrejas_filiadas_isolation_select ON igrejas_filiadas
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_igrejas_filiadas_isolation_insert ON igrejas_filiadas;
CREATE POLICY p_igrejas_filiadas_isolation_insert ON igrejas_filiadas
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_igrejas_filiadas_isolation_update ON igrejas_filiadas;
CREATE POLICY p_igrejas_filiadas_isolation_update ON igrejas_filiadas
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_igrejas_filiadas_isolation_delete ON igrejas_filiadas;
CREATE POLICY p_igrejas_filiadas_isolation_delete ON igrejas_filiadas
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 7. TABELA: usuarios_administrativos (Cadastro de Usuários e RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios_administrativos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ministro_id UUID NOT NULL REFERENCES ministros(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    cargo_ministerial TEXT NOT NULL,
    igreja_filiada TEXT NOT NULL,
    role TEXT NOT NULL,
    cargo_administrativo TEXT NOT NULL,
    departamento TEXT NOT NULL,
    status_acesso TEXT NOT NULL DEFAULT 'ATIVO',
    data_concessao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    foto_url TEXT,
    permissoes_speciais TEXT[],
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status_acesso_usuario CHECK (status_acesso IN ('ATIVO', 'SUSPENSO', 'EM_ANALISE')),
    CONSTRAINT chk_cargo_administrativo CHECK (cargo_administrativo IN ('Administrador', 'Secretário', 'Tesoureiro', 'Conselho de Ética', 'Auditor de Compliance'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_admin_tenant_id ON usuarios_administrativos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_cpf ON usuarios_administrativos(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_admin_cargo ON usuarios_administrativos(cargo_administrativo);

ALTER TABLE usuarios_administrativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_administrativos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_usuarios_admin_isolation_select ON usuarios_administrativos;
CREATE POLICY p_usuarios_admin_isolation_select ON usuarios_administrativos
    FOR SELECT
    USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_usuarios_admin_isolation_insert ON usuarios_administrativos;
CREATE POLICY p_usuarios_admin_isolation_insert ON usuarios_administrativos
    FOR INSERT
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_usuarios_admin_isolation_update ON usuarios_administrativos;
CREATE POLICY p_usuarios_admin_isolation_update ON usuarios_administrativos
    FOR UPDATE
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_usuarios_admin_isolation_delete ON usuarios_administrativos;
CREATE POLICY p_usuarios_admin_isolation_delete ON usuarios_administrativos
    FOR DELETE
    USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 8. TABELA: eventos (Gestão de Eventos, Convenções, Congressos com Banner e Detalhes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    titulo TEXT NOT NULL,
    subtitulo TEXT NOT NULL,
    data_evento TIMESTAMPTZ NOT NULL,
    local TEXT NOT NULL,
    banner_url TEXT NOT NULL,
    descricao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status_evento CHECK (status IN ('ATIVO', 'ENCERRADO', 'RASCUNHO'))
);

CREATE INDEX IF NOT EXISTS idx_eventos_tenant_id ON eventos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_evento);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_eventos_isolation_select ON eventos;
CREATE POLICY p_eventos_isolation_select ON eventos FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_eventos_isolation_insert ON eventos;
CREATE POLICY p_eventos_isolation_insert ON eventos FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_eventos_isolation_update ON eventos;
CREATE POLICY p_eventos_isolation_update ON eventos FOR UPDATE USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_eventos_isolation_delete ON eventos;
CREATE POLICY p_eventos_isolation_delete ON eventos FOR DELETE USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- 9. TABELA: noticias (Gestão de Notícias, Comunicados Oficiais com Banner e Matéria Completa)
-- ============================================================================
CREATE TABLE IF NOT EXISTS noticias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    titulo TEXT NOT NULL,
    subtitulo TEXT NOT NULL,
    data_publicacao TIMESTAMPTZ NOT NULL,
    autor TEXT NOT NULL,
    banner_url TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PUBLICADO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_status_noticia CHECK (status IN ('PUBLICADO', 'RASCUNHO'))
);

CREATE INDEX IF NOT EXISTS idx_noticias_tenant_id ON noticias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_noticias_data ON noticias(data_publicacao);

ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticias FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_noticias_isolation_select ON noticias;
CREATE POLICY p_noticias_isolation_select ON noticias FOR SELECT USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_noticias_isolation_insert ON noticias;
CREATE POLICY p_noticias_isolation_insert ON noticias FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_noticias_isolation_update ON noticias;
CREATE POLICY p_noticias_isolation_update ON noticias FOR UPDATE USING (tenant_id = get_current_tenant_id()) WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS p_noticias_isolation_delete ON noticias;
CREATE POLICY p_noticias_isolation_delete ON noticias FOR DELETE USING (tenant_id = get_current_tenant_id());


