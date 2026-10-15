# PROTOCOLO DE DESENVOLVIMENTO DE ALTA INTEGRIDADE (SIGM CORE)

Este protocolo é a diretriz operacional soberana deste projeto. Ele DEVE ser consultado e validado mentalmente no início de cada tarefa, antes de escrever ou modificar qualquer linha de código. Qualquer intervenção no sistema que ignore estas etapas será considerada uma falha grave de integridade.

---

## 📋 AS 3 REGRAS DE OURO DA ENGENHARIA SIGM

1. **Ação Antes de Conversa (Action Over Talk):**
   Priorize a execução técnica imediata de ferramentas (como lints, builds, snaps) em vez de explicações prolixas ou justificativas textuais. A melhor documentação é o código funcionando sob testes robustos.
   
2. **Verificação de Regras e Skills de Forma Bloqueante:**
   Sempre execute uma checagem de Skills (`view_file` nos arquivos `SKILL.md` aplicáveis como `firebase-skill` ou `frontend-design`) antes de intervir no sistema.
   
3. **Zero Simulação Local (Single Source of Truth):**
   O banco de dados (Firestore) é a única fonte da verdade em tempo real. É terminantemente proibido manter estados locais desalinhados do servidor ou caches locais temporários que mascarem latências do backend.

---

## ⚙️ O PROTOCOLO DE 5 ETAPAS (OBRIGATÓRIO)

Antes de entregar qualquer alteração ao usuário, o engenheiro deve executar internamente as seguintes fases:

### 1. AUDITORIA DE HISTÓRICO E PREVENÇÃO DE REPETIÇÃO
* Analisar minuciosamente todo o histórico da conversa e as correções feitas anteriormente.
* Identificar falhas de lógica recorrentes, bugs de escaneamento ou desvios de escopo.
* Garantir que as diretrizes do Core Banking (como a não-utilização de splits regionais, splits geográficos ou divisões de pagamento que fujam do modelo de Convenção Centralizada) sejam respeitadas.

### 2. VISTORIA DE RESPONSABILIDADE ÚNICA (SRP) E EXIGÊNCIAS
* Validar que cada módulo, função ou método execute apenas **uma coisa** com absoluta excelência.
* Se uma função calcula taxas e também atualiza a tela, divida-a em sub-funções limpas.
* Garantir que todas as solicitações explícitas do usuário foram cobertas desde o início.

### 3. SIMULAÇÃO E AUTO-CORREÇÃO DE ERROS
* Executar testes de simulação lógica do fluxo planejado antes de salvar o arquivo.
* Verificar ativamente:
  * Tratos de erro silenciados (nunca faça `catch(e) {}` vazio).
  * Variáveis nulas, indefinidas ou falta de checagem em campos opcionais.
  * Loops infinitos em ganchos React (`useEffect`).
* Corrigir inconsistências na raiz antes de compilar.

### 4. PROTOCOLO FIREBASE DE ALTA INTEGRIDADE BANCÁRIA
* ** runTransaction:** Toda escrita de saldos, lançamentos, cadastro de eventos ou inscrições críticas deve ser protegida por transações atômicas no Firestore, impedindo conflitos de concorrência.
* **onSnapshot:** Toda atualização de dados cruciais deve ser ouvida via barramento síncrono bi-direcional para que todas as instâncias abertas reflitam a realidade imediatamente.
* **Somas Seguras:** Operações matemáticas em massa devem ser computadas de forma segura ou através de operadores de incremento atômico (`increment()`) no Firestore.
* **Prevenção de Cliques Duplos (Idempotência):** Travas de unicidade e desativação imediata de botões de checkout devem estar presentes para impedir cobranças ou lançamentos duplicados.

### 5. ENTREGA DO CÓDIGO INSPECIONADO
* Escrever o código de forma limpa, modular e altamente tipada (TypeScript estrito).
* Rodar o linter (`npm run lint`) e o compilador (`npm run build`) para assegurar integridade estrutural absoluta.
* Incluir o relatório de auditoria detalhado no rodapé de cada resposta.

---

## 🎨 DIRETRIZES DE DESIGN NEOFINTECH (ANTI-SLOP)

Para manter o visual profissional de alto padrão bancário, evite modismos genéricos de inteligência artificial:

* **Zero Pills Estáticos:** Informações e metadados informativos nunca devem ser encapsulados em badge/pills arredondados e coloridos. Use texto simples separado por pontos discretos (`·` ou `/`).
* **Botões de Ação de Linha Única:** Rótulos de botões de checkout ou filtros devem utilizar `whitespace-nowrap` e ser truncados de forma limpa se necessário.
* **Hierarquia de Cores 60-30-10:**
  * **60% Canvas Mestre:** Fundo escuro (Dark Slate/Navy) ou cinza claro premium.
  * **30% Estrutura:** Bordas ultrafinas de 1px com transparência discreta e cartões sólidos de elevação única.
  * **10% Accents de Ação:** Concentre os tons vivos (como o Emerald ou Violet) estritamente nos botões principais de ação e estados focados.
