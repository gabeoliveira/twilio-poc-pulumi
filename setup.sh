#!/bin/bash
mkdir $1 && cd $1
twilio infra:new
cp -a ./../pulumi-example/. .
rm index.js
cp .env.example .env
export FIND_BEFORE_CREATE=true