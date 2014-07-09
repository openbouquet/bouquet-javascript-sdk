    

$( document ).ready(function() {
    /*
     * Controller part
     */

    loginView = new squid_api.view.LoginView({
        el : '#login',
        autoShow : false
    });
    
    statusView = new squid_api.view.StatusView({
        el : '#status'
    });
    
    squid_api.model.login.on('change:login', function(model) {
        // performed when login is updated
        if (model.get("login")) {
            // login ok
            //contentView.model.set({"message" : "Hello, you are logged with a user account on customer "+squid_api.customerId});
            
        } else {
            // login ko
            //contentView.model.set({"message" : "Please login"});
        }
    });
    
    /*
     * Start the App
     */
    config = {
        "customerId" : null,
        "clientId" : null,
        "projectId" : null,
    };
    squid_api.init(config);

    console.log("squid_api version : "+squid_api.version);
});