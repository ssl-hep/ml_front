# ML_front

Exposes k8s ml resources to users as services:
* JupyterLab.
* TensorFlowAsAService (soon)

A deployment creates node.js based web frontend. The front end authenticates users through globus. User can select to instantiate several different services, select hardware needed, duration, and other parameters. 


## Authorizing users
 
When we want to authorize user we will add him/her to the Elasticseach index at UChicago.
This can be done from lxplus.cern.ch or UChicago. 
#### To add a user to event <EventName>:

curl -X POST "atlas-kibana.mwt2.org:9200/mlfront_users/docs/" -H 'Content-Type: application/json' -d'
{
    "event" : "codas",
    "user" : "John Doe",
    "affiliation" : "Rutgers University",
    "email" : "JohnDoe@gmail.com"
}'

#### To remove a user from event <EventName>:

curl -X POST "atlas-kibana.mwt2.org:9200/mlfront_users/_delete_by_query" -H 'Content-Type: application/json' -d'
{
  "query": { 
    "match": {
      "email": "JohnDoe@gmail.com"
    }
  }
}'

#### To look up users check kibana page: 
http://atlas-kibana.mwt2.org/goto/7ad9cbf9627d180d24e06ac018ac6c4a


## TODO
* add option to update some service parameters
* add cloud deployments
* add ml-front pods monitoring info collection
* make sure k8s reports free resources and existing pod names to avoid clash
* write documentation
* reorganize directory structure to have different instances fully separated
* new authorization plugin
  * in profile add approved or not
  * sending mails asking for approval
  * endpoint that approves
* new instances
* TFAAS
* script to list users
