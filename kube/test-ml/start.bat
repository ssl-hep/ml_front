kubectl create -f namespace.yaml
kubectl label nodes ml.usatlas.org mlnode=true

kubectl create -f service_account.yaml

kubectl create secret -n test-ml generic cert-secret --from-file=key=secrets/certificates/test-ml.pem --from-file=cert=secrets/certificates/test-ml.cer
kubectl create secret -n test-ml generic globus-secret --from-file=gconf=secrets/globus-config.json
kubectl create secret -n test-ml generic config --from-file=mlconf=secrets/config.json
kubectl create secret -n test-ml generic mg-config --from-file=mgconf=secrets/mg-config.json

kubectl create -f frontend.yaml