# Colocar o Vela.tv no ar na Raspberry Pi (nginx + porta 8045)

Site: **https://velatv.zeferius.com** · porta interna: **8045**

## 1. Trazer o projeto do GitHub

```sh
sudo apt update && sudo apt install -y nginx git
# Node 20+ (se ainda não tiver)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

cd /home/pi
git clone <url-do-seu-repositorio> velatv
cd velatv
npm ci
```

## 2. Configurar as variáveis

```sh
cp .env.example .env
nano .env
```

Preencha `MONGO_URL` com o endereço do seu MongoDB, mantenha
`PUBLIC_SITE_URL="https://velatv.zeferius.com"` e `PORT=8045`.

## 3. Gerar a versão de produção

```sh
npm run build:node
```

Isso cria a pasta `.output`. Para testar na hora: `npm start` e abra
`http://IP-DA-RASPBERRY:8045`.

## 4. Deixar rodando sempre (systemd)

```sh
sudo cp deploy/velatv.service /etc/systemd/system/velatv.service
sudo systemctl daemon-reload
sudo systemctl enable --now velatv
sudo systemctl status velatv
```

## 5. nginx + HTTPS

```sh
sudo cp deploy/nginx-velatv.conf /etc/nginx/sites-available/velatv.zeferius.com
sudo ln -s /etc/nginx/sites-available/velatv.zeferius.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d velatv.zeferius.com
```

No seu DNS, aponte `velatv` para o IP público da sua internet e libere as
portas 80 e 443 no roteador para a Raspberry.

## 6. Atualizar depois de mudar algo

```sh
cd /home/pi/velatv
git pull
npm ci
npm run build:node
sudo systemctl restart velatv
```

## Observações

- O `.env` **não** vai para o GitHub: crie-o direto na Raspberry.
- O nginx precisa enviar `X-Forwarded-Proto` (já vem no arquivo pronto) —
  é isso que mantém o login funcionando em HTTPS.
- Listas grandes e vídeo: o arquivo do nginx já desliga buffer e amplia os
  tempos limite, senão a importação de listas de centenas de MB é cortada.
- Conta de administrador: `rithielegui@gmail.com` (criada sozinha no banco no
  primeiro acesso).
