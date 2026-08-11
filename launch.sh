#!/usr/bin/env bash
set -euo pipefail

echo
echo "=================================================="
echo " SURGICAL DEVOPS — LAUNCH"
echo "=================================================="
echo
echo "Selecione o projeto para iniciar a inspeção:"
echo
echo "  1) BH-SMC"
echo "  2) Surgical Kernel"
echo "  3) Outro projeto"
echo "  0) Sair"
echo
read -r -p "Projeto: " PROJECT_OPTION

case "$PROJECT_OPTION" in
  1)
    PROJECT_NAME="BH-SMC"
    PROJECT_PATH="$HOME/bh-smc"
    ;;
  2)
    PROJECT_NAME="Surgical Kernel"
    PROJECT_PATH="$HOME/workspace/bonushora-org/surgical-kernel"
    ;;
  3)
    read -r -p "Caminho absoluto do projeto: " PROJECT_PATH
    [[ -n "$PROJECT_PATH" ]] || { echo "ERRO: caminho não informado."; exit 1; }
    PROJECT_NAME="$(basename "$PROJECT_PATH")"
    ;;
  0)
    echo "Encerrado."
    exit 0
    ;;
  *)
    echo "ERRO: opção inválida."
    exit 1
    ;;
esac

if [[ ! -d "$PROJECT_PATH" ]]; then
  echo "ERRO: projeto não encontrado: $PROJECT_PATH"
  exit 1
fi

if [[ ! -d "$PROJECT_PATH/.git" ]]; then
  echo "ERRO: o diretório selecionado não é um repositório Git: $PROJECT_PATH"
  exit 1
fi

cd "$PROJECT_PATH"
BRANCH="$(git branch --show-current)"
COMMIT="$(git rev-parse --short HEAD)"

echo
echo "=================================================="
echo " PROJETO SELECIONADO"
echo "=================================================="
echo "Nome   : $PROJECT_NAME"
echo "Path   : $PROJECT_PATH"
echo "Branch : $BRANCH"
echo "Commit : $COMMIT"
echo "=================================================="
echo
echo "Contexto físico identificado."
echo "Inspeção cirúrgica pronta para continuidade."
