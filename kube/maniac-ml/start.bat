kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f service_account.yaml

kubectl create secret -n maniac-ml generic cert-secret --from-file=key=secrets/certificates/maniac-ml.pem --from-file=cert=secrets/certificates/maniac-ml.cer
kubectl create secret -n maniac-ml generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n maniac-ml generic config --from-file=mlconf=secrets/config.json


cd ..
kubectl create -f frontend.yaml