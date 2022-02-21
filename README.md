# ML front

Exposes k8s ml resources to users as services:

* JupyterLab.
* TensorFlowAsAService (soon)

A deployment creates node.js based web frontend. The front end authenticates users through globus. User can select to instantiate several different services, select hardware needed, duration, and other parameters.

## Configuration options

 Variable | Meaning | Example value
----|----|----
 EVENT | This will be used in mails, kibana dashboards | codas2019
 SITENAME | address where the front end will be accessible from  | ml.maniac.uchicago.edu
 STATIC_PATH | directory containing static site customizations | ml-usatlas-org,
 NAMESPACE | k8s namespace where all of pods and services will run | maniac-ml
 TITLE | Will be shown in web browser title bar
 SSL | Are JupyterLabs served on https? | false
 APPROVAL_REQUIRED | Is authorization required (on top of globus authentication)? | true
 APPROVAL_EMAIL | Only if authorization is required | ivukotic@cern.ch
 SINGLE_INSTANCE | Limit to only one private Jupyter instance| false
 PUBLIC_INSTANCE | Expose a public JupyterLab instance that anyone can use | true
 MONITOR | Enable user access to monitoring info | true  
 REMOTE_K8S | Enable non local k8s service spawn | false
 REPORTING | Are pods monitored in Elasticsearc | true
 JL_POD | Used to customize JuputerLab pod. | /jupyter-pod.json
 JL_SERVICE | Used to customize JuputerLab service. | /jupyter-service.json
 PLUGINS | list of enabled plugins | ["MONITOR", "SPARK", "PUBLIC_INSTANCE"]

## Authorizing users

If configured to require authorization (APPROVAL_REQUIRED), authorization is automatically sought for authenticated users. Authorization request is approved by a platform owner.  

#### To look up users check kibana page

<http://atlas-kibana.mwt2.org/goto/7ad9cbf9627d180d24e06ac018ac6c4a>

## TODO

* switch from using .json files to fully generated objects.
* completely move to ingress controllers. (spark too)
* change how upper left corner Title is set (should be in pug.)
* add shared filesystem
* add option to mount CVMFS
* add option to update some service parameters
* add cloud deployments
* add postfixes to pods/services
* add ml-front pods monitoring info collection
* SPARK submission
  * submission page
    * file upload (multiple files?)
    * n executors
    * executor memory
    * job name
  * results page. status, link to output.
* write documentation
* TFAAS
* web site
  * Services - running/terminated service
  * Services - services title
