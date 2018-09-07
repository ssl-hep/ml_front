#!/bin/bash

# get cert
certbot certonly -n --standalone --preferred-challenges http -w /usr/src/app/public -d ml-test.slateci.net --agree-tos --email ivukotic@uchicago.edu

# start server
npm start