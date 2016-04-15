Open Bouquet Javascript SDK
======

The JSSDK core library (Version 3)

Provides the base services to build an app using the Bouquet API. 
Exposes the API Data Model as Backbone Models to easely build MVC apps.

Also provides the following core services :
* API configuration
* Authentication management
* Application state management
* Default Filter controller
* Utility methods

Version 3 introduces the "Nested Model".

## API Configuration

### Setup
The API must be explicitly configured by calling
```
api.setup({
    "clientId" : clientId,
	"apiUrl" : apiUrl,
	"customerId" : customerId,
    "projectId" : projectId,
    "domainId" : domainId,
    "selection" : selection,
    "filtersDefaultEvents" : true,
    "defaultShortcut" : "shortcut",
    "apiVersionCheck" : ">=4.2.5",
    "config" : {}
});
```

The arguments are :  
* `clientId` : a required Client Id (ie. the application id)
* `apiUrl` : the API endpoint (default is "api.squidsolutions.com")
* `customerId` : an optional Customer Id
* `projectId` : an optional Project Id,
* `domainId` : an optional Domain Id,
* `defaultShortcut` : an optional Shortcut id to retrieve app State from.
* "apiVersionCheck" : an SemVer string to enforce Server API version check
* `config`: an optional default configuration (state)

Some of these arguments may also be overridden by setting URL parameters such as :  
https://api.squidsolutions.com/apps/release/squidflow/?apiUrl=api.squidsolutions.com&projectId=squidflow&domainId=usage&customerId=squid  
In addition to this, some extra parameter are supported :  
* `api` : the api branch (dev/staging/release)
* `version` : the api version (4.2)
* `debug` : set the api to debug (e.g. do not redirect on login failure)

### Initialization
After setting-up the API, the init process can take place. 
This process is triggered by calling the API init method :
```
api.init();
```
The init method will check for the user login by fetching the Access Token associated to the Access Code passed as a "code" parameter of the url. 
If user login is granted, the `squid_api.model.login` Model object will be set accordingly. 
It will also fetch the Customer model (root object) associated to the current user.
The customer will be set to `squid_api.model.customer`.

## Application Models
The JSSDK provides various Backbone Models under the `squid_api.model` namespace.  

### squid_api.model.config 
Represents the application state (current filters selection, selected dimensions...).  
Config is a schema-free object nevertheless some attributes are commonly used :  
* selection : the current filters selection  
* project : the current project ID (oid)  
* domain : the current domain ID (oid)  

Example : ```squid_api.model.config.get("selection")``` returns the current filters selection as a JSON object.  

Behaviors :  
* set at api.init() if a state or a shortcut or a bookmark parameter is set  
* will be persisted to an API State object upon any change  
* will trigger a FacetJob computation if its "selection" is changed
* if its "project" attribute is changed then the "domain" attribute is reset to null
* if its "domain" attribute is changed then the "selection" is reset
* if its "selection" attribute is changed then a FacetJob will be created and the computation results will
update the squid_api.model.filters.

### squid_api.model.login
The current logged-in user (also contains the auth token).  
Behaviors :  
* Initial value will be fetched at api.init()  

### squid_api.model.customer (the "Nested Model")
Holds the nested backbone model for the current Customer.  
It will be lazily updated with nested models as they are be fetched by views such as CollectionManagementWidget.
For instance, when selecting a project from the ProjectManagementWidget, the  `squid_api.model.customer.get("projects")` Collection 
will be updated with the corresponding fetched project Model.  

The nested model is a very convenient way of accessing the api model data.  
The root object is customer which you can get by calling the squid_api.getCustomer() method.  
This method returns a Promise so to get the customer object :  
```
squid_api.getCustomer().done( function(customerModel){
	// ...
});
```
Nested model objects have a specific `load` method which when called on a Model or a Collection will fetch it in a thread-safe manner 
(all callers will receive the same Promise). When called on a Collection, load can take an ID argument to fetch only the corresponding child model.  
Note that the nested model also works as a cache : when called again, the same load() method will not issue an http request as the model/collection 
is already present in the nested model.  
  
Examples :
```
// fetch all projects
squid_api.getCustomer().done( function(customerModel){
	customerModel.get("projects").load().done( function(projectsCollection){
		// ...
	});
});
```
```
// fetch the project with id "1"
squid_api.getCustomer().done( function(customerModel){
	customerModel.get("projects").load("1").done( function(projectModel){
		// ...
	});
});
```


Behaviors :  
* Will be automatically fetched at api.init()  

### squid_api.model.filters
This model holds the results of a FacetJob computation (triggered by a squid_api.model.config.selection change event).  
Example : ```squid_api.model.filters.get("selection").facets[0].items``` returns the actual values (facetItems) of the first facet.  
Here is a sample FiltersModel :
```json
{
	"selection" : {
	    "facets" : [ {
	        "dimension" : {
	            "id" : {
	                "projectId" : "musicbrainz",
	                "domainId" : "artist",
	                "dimensionId" : "last_updated"
	            },
	            "expression" : {
	                "value" : "TO_DATE('last_updated')"
	            },
                "name" : "Last Updated",
                "oid" : "last_updated", 
                "type": "CONTINUOUS"
	        },
	        "items" : [ {
                	"type" : "i",
                	"lowerBound" : "2008-01-01T23:00:00.000+0000",
                	"upperBound" : "2014-10-06T23:00:00.000+0000"
            	} ],
	        "selectedItems" : [ {
	            "type" : "i",
	            "lowerBound" : "2014-10-05T23:00:00.000+0000",
	            "upperBound" : "2014-10-06T23:00:00.000+0000"
	        } ]
	    } ]
	}
}	
```
