kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f ml_public.yaml

kubectl create -f service_account.yaml

kubectl create secret -n ml-usatlas-org generic cert-secret --from-file=key=secrets/certificates/ml-front.key.pem --from-file=cert=secrets/certificates/ml-front.cert.cer
kubectl create secret -n ml-usatlas-org generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n ml-usatlas-org generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n ml-usatlas-org generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml