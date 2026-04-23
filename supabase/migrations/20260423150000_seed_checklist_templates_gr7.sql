-- Seed: 3 modelos de checklist padrão extraídos de docs/Checklist.html
-- Instalação de Servidor | Instalação de Retaguarda | Instalação de Caixa (NFCe)
-- Cada item carrega o link do manual correspondente no Notion da GR7.
-- Idempotente: se já existir um template com o mesmo nome, não faz nada
-- (seguro para rodar múltiplas vezes ou em ambiente onde o usuário já tenha customizado).

DO $$
DECLARE
  v_servidor_id   UUID;
  v_retaguarda_id UUID;
  v_caixa_id      UUID;
BEGIN
  -- ========================================================================
  -- SERVIDOR
  -- ========================================================================
  IF NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE nome = 'Instalação de Servidor') THEN
    INSERT INTO public.checklist_templates (nome, ativo)
    VALUES ('Instalação de Servidor', TRUE)
    RETURNING id INTO v_servidor_id;

    INSERT INTO public.checklist_template_itens (template_id, texto, link, ordem) VALUES
      (v_servidor_id, 'Preparar acesso pelo AnyDesk', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480bdb716d7a4ce8f6b5b', 0),
      (v_servidor_id, 'Instalar o Master Remote no cliente', 'https://gr7autocom.notion.site/INSTALANDO-REMOTE-NO-CLIENTE-E-ADICIONANDO-AO-CONTROL-2659a16d674481069e5df972792afa0e', 1),
      (v_servidor_id, 'Transferir arquivos GR7 pelo Master', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744808b8c38d7791241ade3', 2),
      (v_servidor_id, 'Otimização do Windows para Uso do Sistema GR7', 'https://gr7autocom.notion.site/CONFIGURANDO-WINDOWS-PARA-O-USUARIO-2689a16d674480c08d43c5867b2177dc', 3),
      (v_servidor_id, 'Ajustes rápidos no Windows', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d67448085bbfef928d9f39a9a', 4),
      (v_servidor_id, 'Pastas na Área de Trabalho', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744800790e2d496e564ada0', 5),
      (v_servidor_id, '(Se possível) Renomear o computador', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480c393c1e8ad3b8580e6', 6),
      (v_servidor_id, 'Compartilhamento de redes do Windows', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480ee8ff6cf2becf374f8', 7),
      (v_servidor_id, 'Fixar pastas no Acesso Rápido', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744807bb47fdb698a6bb6b9', 8),
      (v_servidor_id, '(Se dedicado) Instalar WASSetup (Wise Auto Shutdown)', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744805fb740f32f1f828e9d', 9),
      (v_servidor_id, 'Instalar e definir Notepad++', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480f1acaec0f3fddae730', 10),
      (v_servidor_id, 'Instalar a fonte dos relatórios', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e?pvs=97#2699a16d67448067b3eaef32c6975911', 11),
      (v_servidor_id, 'Copiar o registro do cliente', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744802b8643e06706c62a19', 12),
      (v_servidor_id, 'Instalar e configurar o MySQL 5.7', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-SERVER-5-7-38-a125c940921143429f7c5b25d5cfdab9', 13),
      (v_servidor_id, 'Configuração MySQL Server / My.ini', 'https://gr7autocom.notion.site/CONFIGURA-O-MYSQL-SERVER-MY-INI-2659a16d67448053b567d2673f45d5f8', 14),
      (v_servidor_id, 'Instalar e configurar o MySQL Administrator', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-ADMINISTRATOR-4de01b2e6580441098c482691842f347', 15),
      (v_servidor_id, 'Instalar e configurar o MySQL Manager 2007', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-MANAGER-2007-c4ee483a15774877875a370be49cb784', 16),
      (v_servidor_id, 'Restaurar a base no Administrator', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d67448080873ef00890f2343f', 17),
      (v_servidor_id, 'Restaurar as bases em ordem', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e?pvs=97#27d9a16d6744808894b2f569143defb3', 18),
      (v_servidor_id, 'Compartilhar pastas do servidor', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480bf9dd7dc3db6e2aa77', 19),
      (v_servidor_id, 'Ajustar Demo.ini e config.ini', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d67448086859fc99e61ee26e5', 20),
      (v_servidor_id, 'Criar atalhos GR7 e organizar', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d67448065bcefd02e8da923c0', 21),
      (v_servidor_id, 'Configurar diretórios no Retaguarda', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d67448025841af612a7ce3124', 22),
      (v_servidor_id, 'Rodar o ATUALIZA GR7', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d674480648992c41cd28ced47', 23),
      (v_servidor_id, 'Configurar o Verificador GR7 na inicialização', 'https://gr7autocom.notion.site/INSTALANDO-SERVIDOR-GR7-MYSQL-31f3b8c99a2946fb8db6777287e7ae6e#2699a16d6744809e911fcea916537e40', 24),
      (v_servidor_id, 'Instalando WebCharts e ServerMobile como serviço', 'https://gr7autocom.notion.site/INSTALANDO-WEBCHARTS-E-SERVERMOBILE-COMO-SERVI-O-1389a16d674480f08f6bfcdea16bb71d', 25),
      (v_servidor_id, 'Criando e Configurando Rotina de Backup MySQL', 'https://gr7autocom.notion.site/CRIANDO-E-CONFIGURANDO-ROTINA-DE-BACKUP-MYSQL-2699a16d674480b284b6f9c0c8b64a22', 26),
      (v_servidor_id, 'Criar exceções no Windows Defender (Executar BAT no Tutorial abaixo)', 'https://gr7autocom.notion.site/CRIAR-EXCE-ES-NO-WINDOWS-DEFENDER-2809a16d674480c0a7fbf1353b1b6aa1', 27);
  END IF;

  -- ========================================================================
  -- RETAGUARDA
  -- ========================================================================
  IF NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE nome = 'Instalação de Retaguarda') THEN
    INSERT INTO public.checklist_templates (nome, ativo)
    VALUES ('Instalação de Retaguarda', TRUE)
    RETURNING id INTO v_retaguarda_id;

    INSERT INTO public.checklist_template_itens (template_id, texto, link, ordem) VALUES
      (v_retaguarda_id, 'Preparar acesso pelo AnyDesk', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d674480178a79fdd8401b3027', 0),
      (v_retaguarda_id, 'Instalar o Master Remote no cliente', 'https://gr7autocom.notion.site/INSTALANDO-REMOTE-NO-CLIENTE-E-ADICIONANDO-AO-CONTROL-2659a16d674481069e5df972792afa0e', 1),
      (v_retaguarda_id, 'Transferir arquivos GR7 pelo Master', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d6744807fa3cffc97531bd8df', 2),
      (v_retaguarda_id, 'Otimização do Windows para Uso do Sistema GR7', 'https://gr7autocom.notion.site/CONFIGURANDO-WINDOWS-PARA-O-USUARIO-2689a16d674480c08d43c5867b2177dc', 3),
      (v_retaguarda_id, 'Ajustes rápidos no Windows', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d67448052adb4ebe04c134262', 4),
      (v_retaguarda_id, 'Pastas na Área de Trabalho', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d6744800587a5c44f8db0f085', 5),
      (v_retaguarda_id, '(Se possível) Renomear o computador', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d674480d19123fe57b8703144', 6),
      (v_retaguarda_id, 'Compartilhamento de redes do Windows', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d6744803ba6e8effb3970d0f2', 7),
      (v_retaguarda_id, 'Fixar pastas no Acesso Rápido', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d674480eb901dcd4a3d32f02c', 8),
      (v_retaguarda_id, 'Instalar a fonte dos relatórios', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d674480928a08e13c773bf520', 9),
      (v_retaguarda_id, 'Atualizar Registro e colocar no Servidor', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d67448056a7e7c962d4946609', 10),
      (v_retaguarda_id, 'Instalar MySQL Manager', 'https://www.notion.so/INSTALANDO-E-CONFIGURANDO-O-MYSQL-MANAGER-2007-c4ee483a15774877875a370be49cb784?pvs=21', 11),
      (v_retaguarda_id, 'Ajustar Demo.ini e config.ini', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b?pvs=97#26a9a16d6744801cb6fac09b5c6c72ae', 12),
      (v_retaguarda_id, 'Criar atalhos GR7 e organizar', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d67448042b1e4c03012197f63', 13),
      (v_retaguarda_id, 'Rodar o ATUALIZA GR7', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b?pvs=97#26a9a16d6744803e90a3f3f2927e3180', 14),
      (v_retaguarda_id, 'Configurar o ATUALIZA GR7 na inicialização', 'https://gr7autocom.notion.site/INSTALANDO-RETAGUARDA-GR7-8ac205a8fab74a6682cccb3c1ea8de5b#26a9a16d6744809eaa5bfc5498c29d64', 15),
      (v_retaguarda_id, 'Permissão para acessar rede compartilhada / Credenciais do Windows', 'https://gr7autocom.notion.site/PERMISS-O-PARA-ACESSAR-REDE-COMPARTILHADA-CREDENCIAIS-DO-WINDOWS-27e9a16d67448008a4b1fbccf7423f17', 16),
      (v_retaguarda_id, 'Configurando periféricos no Sistema GR7 (Caso tenha Impressora/Etiqueta)', 'https://gr7autocom.notion.site/CONFIGURANDO-PERIFERICOS-NO-SISTEMA-GR7-2699a16d6744806eb63cff2b84c2cd7e', 17),
      (v_retaguarda_id, 'Criar exceções no Windows Defender', 'https://gr7autocom.notion.site/CRIAR-EXCE-ES-NO-WINDOWS-DEFENDER-2809a16d674480c0a7fbf1353b1b6aa1', 18);
  END IF;

  -- ========================================================================
  -- CAIXA (NFCe / Frente de Caixa)
  -- ========================================================================
  IF NOT EXISTS (SELECT 1 FROM public.checklist_templates WHERE nome = 'Instalação de Caixa (NFCe)') THEN
    INSERT INTO public.checklist_templates (nome, ativo)
    VALUES ('Instalação de Caixa (NFCe)', TRUE)
    RETURNING id INTO v_caixa_id;

    INSERT INTO public.checklist_template_itens (template_id, texto, link, ordem) VALUES
      (v_caixa_id, 'Preparar acesso pelo AnyDesk', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d67448056bd9cccf8e9d2f691', 0),
      (v_caixa_id, 'Instalar o Master Remote no cliente', 'https://gr7autocom.notion.site/INSTALANDO-REMOTE-NO-CLIENTE-E-ADICIONANDO-AO-CONTROL-2659a16d674481069e5df972792afa0e', 1),
      (v_caixa_id, 'Transferir arquivos GR7 pelo Master', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d6744803dada5d076fb6ac295', 2),
      (v_caixa_id, 'Otimização do Windows para Uso do Sistema GR7', 'https://gr7autocom.notion.site/CONFIGURANDO-WINDOWS-PARA-O-USUARIO-2689a16d674480c08d43c5867b2177dc', 3),
      (v_caixa_id, 'Ajustes rápidos no Windows', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d67448017a540d6796c95f95e', 4),
      (v_caixa_id, 'Pastas na Área de Trabalho', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d674480b493b6e55c05001f42', 5),
      (v_caixa_id, '(Se possível) Renomear o computador', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d67448031a488cf28707c1eda', 6),
      (v_caixa_id, 'Compartilhamento de redes do Windows', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d67448033848adb5c79fedf05', 7),
      (v_caixa_id, 'Fixar pastas no Acesso Rápido', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497?pvs=97#26a9a16d674480b980a0df9fce9b96f6', 8),
      (v_caixa_id, 'Atualizar Registro e colocar no Servidor', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497?pvs=97#26a9a16d674480579240f028f87242ea', 9),
      (v_caixa_id, 'Instalar e configurar o MySQL 5.7', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-SERVER-5-7-38-a125c940921143429f7c5b25d5cfdab9', 10),
      (v_caixa_id, 'Configuração MySQL Server / My.ini', 'https://gr7autocom.notion.site/CONFIGURA-O-MYSQL-SERVER-MY-INI-2659a16d67448053b567d2673f45d5f8', 11),
      (v_caixa_id, 'Instalar e configurar o MySQL Administrator', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-ADMINISTRATOR-4de01b2e6580441098c482691842f347', 12),
      (v_caixa_id, 'Instalar e configurar o MySQL Manager 2007', 'https://gr7autocom.notion.site/INSTALANDO-E-CONFIGURANDO-O-MYSQL-MANAGER-2007-c4ee483a15774877875a370be49cb784', 13),
      (v_caixa_id, 'Restaurar a base no Administrator', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d67448030bcfdc5c1c8367c99', 14),
      (v_caixa_id, 'Ajustar Demo.ini e config.ini', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d674480dd8e62e28be4d9bb54', 15),
      (v_caixa_id, 'Criar atalhos GR7 e organizar', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#26a9a16d674480f09e2dea6378df59a2', 16),
      (v_caixa_id, 'Rodar o ATUALIZA GR7', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497?pvs=97#26b9a16d674480d38a7ae23f70954fc9', 17),
      (v_caixa_id, 'Permissão para acessar rede compartilhada / Credenciais do Windows', 'https://gr7autocom.notion.site/PERMISS-O-PARA-ACESSAR-REDE-COMPARTILHADA-CREDENCIAIS-DO-WINDOWS-27e9a16d67448008a4b1fbccf7423f17', 18),
      (v_caixa_id, 'Configurar o ATUALIZA GR7 na inicialização', 'https://gr7autocom.notion.site/INSTALANDO-FRENTE-DE-CAIXA-GR7-6cae4ac927b345888ecb61eab9b16497#2b59a16d6744805db5dbe4bcf72e6e2b', 19),
      (v_caixa_id, 'Configurando periféricos no Sistema GR7 (Caso tenha Impressora/Balança)', 'https://gr7autocom.notion.site/CONFIGURANDO-PERIFERICOS-NO-SISTEMA-GR7-2699a16d6744806eb63cff2b84c2cd7e', 20),
      (v_caixa_id, 'Instalando fonte para relatório (Caso vá usar Retaguarda)', 'https://gr7autocom.notion.site/INSTALANDO-FONTE-PARA-RELAT-RIO-27e9a16d6744800aad99f4fffd8385b1', 21),
      (v_caixa_id, 'Criar exceções no Windows Defender', 'https://gr7autocom.notion.site/CRIAR-EXCE-ES-NO-WINDOWS-DEFENDER-2809a16d674480c0a7fbf1353b1b6aa1', 22);
  END IF;
END $$;
