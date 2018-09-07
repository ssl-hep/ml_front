# ML front

Exposes k8s ml resources to users as services:
* JupyterLab.
* TensorFlowAsAService (soon)

A deployment creates node.js based web frontend. The front end authenticates users through globus. User can select to instantiate several different services, select hardware needed, duration, and other parameters. 


## Authorizing users

If configured to require authorization (APPROVAL_REQUIRED), authorization is automatically sought for authenticated users. Authorization request is approved by a platform owner.  

#### To look up users check kibana page: 
http://atlas-kibana.mwt2.org/goto/7ad9cbf9627d180d24e06ac018ac6c4a


## TODO
* add option to update some service parameters
* add cloud deployments
* add ml-front pods monitoring info collection
* make sure k8s reports free resources and existing pod names to avoid clash
* write documentation
* new authorization plugin
  * in profile approved or not does not refresh without full log out/log in.
  * endpoint that approves should return OK/NOT OK.
* new instances
* TFAAS
* script to list users
