kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f service_account.yaml

REM Not needed as this is done by certmanager.
REM kubectl create secret tls -n codas codas-tls --key secrets/certificates/codas.pem --cert secrets/certificates/codas.cer
kubectl create secret -n codas generic globus-secret --from-file=gconf=secrets/globus-config.json

kubectl delete secret -n codas config
kubectl create secret -n codas generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n codas generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl delete -f frontend.yaml
kubectl create -f frontend.yaml

