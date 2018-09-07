#Install vim
apt-get update
apt-get install python-software-properties apt-file -y
apt-file update
apt-get install software-properties-common -y
apt-get install vim less -y  

curl -X GET "atlas-kibana.mwt2.org:9200/mlfront_users/docs/_search?q=email:ivukotic@cern.ch"
