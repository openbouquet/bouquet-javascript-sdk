jssdk2
======

The JSSDK core library (Version 2)

Provides the base services to build an app using the Squid Analyitcs API. 
Exposes the API Data Model as Backbone Models to easely build MVC apps.

Also provides the following core services :
* API configuration
* Authentication management
* Application state management
* Default Filter controller
* Utility methods

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
* `config`: an optional default configuration (state)

Some of these arguments may also be overridden by setting URL parameters such as :  
https://api.squidsolutions.com/apps/release/squidflow/?apiUrl=api.squidsolutions.com&projectId=squidflow&domainId=usage&customerId=squid  
In addition to this, some extra parameter are supported :  
* `api` : the api branch (dev/staging/release)
* `version` : the api version (4.2)
* `debug` : set the api to debug (e.g. do not redirect on login failure)

### Initialization
After setting-up the API, the init process must take place. 
This process is triggered by calling the API init method :
```
api.init();
```
The init method will check for the user login by fetching the Access Token associated to the Access Code passed as a "code" parameter of the url. 
If user login is granted, the `squid_api.model.login` Model object will be set accordingly. 
It will also fetch for the Customer model object associated to the verified user and set to `squid_api.model.customer`.

## Application Models
The JSSDK provides various Backbone Models under the `squid_api.model` namespace.  

### squid_api.model.config 
Represents the application state (current filters selection, selected dimensions...).  
Config is a schema-free object nevetheless some attributes are commonly used :  
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

### squid_api.model.login
The current logged-in user (also contains the auth token).  
Behaviors :  
* Initial value will be fetched at api.init()  

### squid_api.model.customer
Holds the nested backbone model for the current Customer.  
It will be lazily updated with nested models as they are be fetched by views such as CollectionManagementWidget.
For instance, when selecting a project from the ProjectManagementWidget, the  ```squid_api.model.customer.get("projects")``` Collection will be updated with the corresponding fetched project Model.  
Behaviors :  
* Initial value will be fetched at api.init().  

### squid_api.model.filters
This model holds the results of a FacetJob computation (triggered by a config.selection change).  
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

## Authentication management
TODO

## Utility methods
TODO
