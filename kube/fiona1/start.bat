kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f ml_public.yaml

kubectl create -f service_account.yaml


kubectl create secret tls -n fiona1 fiona1-tls --key secrets/certificates/ml-front.key.pem --cert secrets/certificates/ml-front.cert.cer
kubectl create secret -n fiona1 generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n fiona1 generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n fiona1 generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml