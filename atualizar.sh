#!/bin/bash
# atualizar.sh — roda dentro da pasta do projeto na Raspberry.
# Uso:  bash atualizar.sh
# Ele: puxa do Git, instala dependências, gera a versão de produção
# e reinicia o site na porta 8045 (sem mexer no nginx).

set -e
cd "$(dirname "$0")"

echo "==> Puxando novidades do GitHub..."
git pull

echo "==> Instalando dependências..."
npm ci

echo "==> Gerando versão de produção..."
npm run build:node

echo "==> Reiniciando o serviço..."
sudo systemctl restart velatv

echo ""
echo "Pronto! Verifique com: sudo systemctl status velatv"
echo "Site: https://velatv.zeferius.com"
