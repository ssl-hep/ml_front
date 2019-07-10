kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f service_account.yaml

kubectl create secret tls -n codas codas-tls --key secrets/certificates/codas.pem --cert secrets/certificates/codas.cer

#kubectl create secret -n codas generic cert-secret --from-file=key=secrets/certificates/codas.pem --from-file=cert=secrets/certificates/codas.cer
kubectl create secret -n codas generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n codas generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n codas generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml

