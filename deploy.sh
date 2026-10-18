#!/usr/bin/env bash
exec /home/ubuntu/projects/art-vault/deploy-vaults.sh "$(basename "$PWD")" "$@"
