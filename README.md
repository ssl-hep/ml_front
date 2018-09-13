# ML front

Exposes k8s ml resources to users as services:
* JupyterLab.
* TensorFlowAsAService (soon)

A deployment creates node.js based web frontend. The front end authenticates users through globus. User can select to instantiate several different services, select hardware needed, duration, and other parameters. 

## Configuration options

 Variable | Meaning | Example value 
----|----|----
 SITENAME | address where the front end will be accessible from  | ml.maniac.uchicago.edu
 NAMESPACE| k8s namespace where all of pods and services will run | maniac-ml 
 SSL | Are JupyterLabs served on https? |false
 STATIC_BASE_PATH | points to directory with the static web pages | maniac-ml 
 APPROVAL_REQUIRED | Is authorization required (on top of globus authentication)? | true 
 APPROVAL_EMAIL | Only if authorization is required | ivukotic@cern.ch 
 SINGLE_INSTANCE | Limit to only one private Jupyter instance| false 
 PUBLIC_INSTANCE | Expose a public JupyterLab instance that anyone can use | true 
 MONITOR | Enable user access to monitoring info | true 
 TFAAS | Enable Tensorflow as a service | false 
 REMOTE_K8S | Enable non local k8s service spawn | false 
 REPORTING | Are pods monitored in Elasticsearc | true 
 JL_POD | Used to customize JuputerLab pod. | /jupyter-pod.json 
 JL_SERVICE | Used to customize JuputerLab service. | /jupyter-service.json 



## Authorizing users

If configured to require authorization (APPROVAL_REQUIRED), authorization is automatically sought for authenticated users. Authorization request is approved by a platform owner.  

#### To look up users check kibana page: 
http://atlas-kibana.mwt2.org/goto/7ad9cbf9627d180d24e06ac018ac6c4a


## TODO
* add option to update some service parameters
* add cloud deployments
* add ml-front pods monitoring info collection
* Follow events. No alert on instance creation. Follow events and on change update ES. Add refresh button on services.html. (add status to services table: creating, status, dead... ). Remove "resources" button.
* Move configuration from secret to config map
* write documentation
* new authorization plugin
  * in profile approved or not does not refresh without full log out/log in.
  * endpoint that approves should return OK/NOT OK.
* waiting for the pod to start ...
* TFAAS
* script to list users
