kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true



kubectl create -f service_account.yaml

kubectl create secret tls -n maniac-ml maniac-ml-tls --key secrets/certificates/maniac-ml.pem --cert secrets/certificates/maniac-ml.cer
kubectl create secret -n maniac-ml generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n maniac-ml generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n maniac-ml generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml