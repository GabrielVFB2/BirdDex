# BirdDex

## Executar localmente no Windows

Abra o PowerShell na pasta do projeto e execute:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra o endereço local mostrado pelo Vite (normalmente `http://localhost:5173`).
Não abra `index.html` diretamente: este projeto usa Vite e React, então a página
precisa ser servida pelo servidor de desenvolvimento.

## Configuração do Supabase

O arquivo `.env` na raiz deve conter `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` do projeto Supabase. Não compartilhe nem publique esses
valores.

Para configurar o banco, abra o **SQL Editor** do Supabase e execute os arquivos
em `supabase/migrations/` em ordem cronológica, do mais antigo para o mais novo.
Sem as migrações, recursos como coleção e notificações não encontram suas tabelas.

## Build de produção

```powershell
npm.cmd run build
```
