/*
 * GLoader - Web resources loader
 * Author: Gabriel Hautclocq
 * URL   : https://github.com/gabsoftware/gloader
 *
 */
var GLoader = function GLoader() {
    "use strict";
    this.graph      = new DepGraph();
    this.validTypes = [ "js", "css" ];
};
if( typeof exports !== "undefined" ) {
    exports.GLoader = GLoader;
}
GLoader.prototype = {
    /**
    * Add a script to the dependency graph. If a dependency already exists with this id, this method will do nothing.
    */
    "addScript": function( id, data ) {
        "use strict";
        return this.addResource( id, data, "js" );        
    },


    /**
    * Add a stylesheet to the dependency graph. If a dependency already exists with this id, this method will do nothing.
    */
    "addStylesheet": function( id, data ) {
        "use strict";
        return this.addResource( id, data, "css" );
    },

    /**
    * Add a generic resource to the dependency graph. If a dependency already exists with this id, this method will do nothing.
    */
    "addResource": function( id, data, type ) {
        "use strict";
        if( ! id ) {
            throw new Error( "id was empty" );
        }
        if( typeof id !== "string" ) {
            throw new Error( "id was not a string" );
        }
        if( ! data ) {
            throw new Error( "data was empty for script #" + id );
        }
        if( typeof data !== "object" ) {
            throw new Error( "data was not an object for #" + id );
        }
        if( ! data.url || typeof data.url !== "string" ) {
            throw new Error( "data.url was not a string for #" + id );
        }
        if( data.fallback && typeof data.fallback !== "string" ) {
            throw new Error( "data.fallback was not a string for #" + id );
        }
        if( ! type ) {
            throw new Error( "type cannot be empty for #" + id );
        }
        if( typeof type !== "string" ) {
            throw new Error( "type was not a string for #" + id );
        }
        if( this.validTypes.indexOf( type ) == -1 ) {
            throw new Error( "type was not a valid value for #" + id );
        }

        data.type = type;

        return this.graph.addNode( id, data );
    },

    /**
    * Remove a resource from the dependency graph.
    */
    "removeResource": function( id ) {
        "use strict";
        return this.graph.removeNode( id );
    },

    "hasResource": function( id ) {
        "use strict";
        return this.graph.hasNode( id );
    },

    "addDependency": function( idfrom, idto ) {
        "use strict";
        return this.graph.addDependency( idfrom, idto );
    },

    "removeDependency": function( from, to ) {
        "use strict";
        return this.graph.removeDependency( idfrom, idto );
    },

    "getData": function( id ) {
        "use strict";
        console.log( "getData with", id );
        return this.graph.getNodeData( id );
    },

    "loadResource": function( id ) {
        "use strict";
        console.log( "loadResource with", id );
        var self = this;

        return new Promise( function( resolve, reject ) {

            var obj  = self.getData( id );
            var url  = obj.url,
                type = obj.type;

            console.log( "Chargement de " + type + " : " + url );

            var r = false, t, s;

            if( type == "js" ) {
                t        = document.getElementsByTagName( "script" )[0];
                s        = document.createElement       ( "script" );
                s.type   = "text/javascript";
                s.src    = url;
                s.defer  = true;
            } else if( type == "css" ) {
                s = document.createElement( "link"  );
                s.type   = "text/css";
                s.rel    = "stylesheet";
                s.href   = url;
            }

            s.onload = s.onreadystatechange = function () {
                console.log( type + " s.onload " + url );
                if( ! r && ( ! this.readyState || this.readyState == "complete" ) ) {
                    r = true;
                    resolve( this );
                    console.log( "resolved : " + type + " " + url );
                }
            };

            s.onerror = s.onabort = function( message ) {

                console.log( "fallback pour " + obj.cdn );

                var url2      = obj.fallback,
                    type2     = obj.type;

                console.log( "Chargement de " + type2 + " : " + url2 );

                var r2 = false, t2, s2;

                if( type2 == "js" ) {
                    t2 = document.getElementsByTagName("script")[0];
                    s2 = document.createElement       ("script");
                    s2.type   = "text/javascript";
                    s2.src    = url2;
                    s2.defer  = true;
                } else if( type2 == "css" ) {
                    s2 = document.createElement       ( "link"  );
                    s2.type   = "text/css";
                    s2.rel    = "stylesheet";
                    s2.href   = url2;
                }

                s2.onload = s.onreadystatechange = function () {
                    console.log( type2 + " s2.onload " + url2 );
                    if( ! r2 && ( ! this.readyState || this.readyState == "complete" ) ) {
                        r2 = true;
                        resolve( this );
                        console.log( "resolved : " + type2 + " " + url2 );
                    }
                };

                s2.onerror = s2.onabort = reject;

                if( type2 == "css" ) document.body.appendChild ( s2     );
                else                 t2.parentNode.insertBefore( s2, t2 );
            };
            if( type == "css" ) document.body.appendChild( s    );
            else                t.parentNode.insertBefore( s, t );

        });
    },

    // load an array of resources (a step) in parallel
    "loadResources": function( step ) {
        "use strict";
        console.log( "loadResources with", step );
        var self = this;
        var proms = [], prom;
        for( var i = 0, n = step.length; i < n; i++ ) {
            prom = self.loadResource( step[ i ] );
            proms.push( prom );
        }
        return Promise.all( proms );
    },

    // helper function to run sequencially several async tasks
    "sequence": function( tasks, fn ) {
        "use strict";
        var self = this;
        return tasks.reduce( function( promise, task ) {
            return promise.then( function( onFulfilled, onRejected ) {
                console.log( "resources step loaded!" );
                return fn( task );
            }.bind( self ) );
        }.bind( self ), Promise.resolve() );
    },

    // begin the loading of the resources
    "load": function() {
        "use strict";
        var self = this;

        var steps = self.graph.steps();
        if( ! steps || ! Array.isArray( steps ) || ! steps.length ) {
            throw new Error( "nothing to load" );
        }

        // on lance la séquence de ressources à charger
        return self.sequence( steps, self.loadResources.bind( self ) ).then( function( onFulfilled, onRejected ) {

            // (optionnel) code à exécuter lorsque toutes les ressources sont chargées
            console.log( "jquery et bootstrap prêts !" );

        }, function( message ) {

            // (optionnel) code à exécuter si une des ressources n'est pas chargée
            console.log( "problème !", message );

        });


    }

};