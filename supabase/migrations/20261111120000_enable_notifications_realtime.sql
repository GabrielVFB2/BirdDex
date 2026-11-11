/*
# Ativar tempo real para notificações

- Adiciona `public.notifications` à publicação `supabase_realtime`, necessária para que o
  sino e a página de notificações recebam novos avisos sem recarregar.
- Sem esta migração o app ainda funciona (atualiza a cada ~45 s e ao voltar para a aba),
  mas não em tempo real.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
