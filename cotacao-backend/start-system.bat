@echo off
title Nicopel Cargo - Sistema de Cotacao
echo =======================================================
echo           Nicopel Cargo - Sistema de Cotacao           
echo =======================================================
echo.

:: 1. Verificar conexao com o Tailscale
echo [1/3] Verificando conexao com o Tailscale...
tailscale status >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Nao foi possivel detectar o Tailscale ativo.
    echo Certifique-se de que o Tailscale esta conectado para acessar o banco de dados.
    echo.
    pause
) else (
    echo [OK] Tailscale detectado e ativo!
)
echo.

:: 2. Entrar no diretorio da aplicacao
echo [2/3] Entrando no diretorio da aplicacao...
cd /d "%~dp0"
echo Diretorio atual: %cd%
echo.

:: 3. Iniciar o servidor NestJS
echo [3/3] Iniciando o servidor NestJS...
echo O sistema estara disponivel em: http://localhost:3000
echo.
npm run start
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o sistema de cotacao.
    pause
)
