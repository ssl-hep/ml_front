REM kubectl create ns ml
REM kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f service_account.yaml

kubectl create secret tls -n ml codas-tls --key secrets/certificates/codas.pem --cert secrets/certificates/codas.cer
kubectl create secret -n ml generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n ml generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n ml generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml

