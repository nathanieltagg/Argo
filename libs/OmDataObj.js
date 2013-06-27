

var gCurFile = "current.root";

var gOmData = new OmDataObj;

function OmDataObj()
{
  this.paths = [];
  this.cur_cycle = "";
  this.file = gCurFile;
  this.status = "uninitialized";  
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
  
}


OmDataObj.prototype.add = function(path)
{
  // Ensure not a duplicate entry.
  if( $.inArray(path,this.paths)==-1)
    this.paths.push(path);

  console.log("OmDataObj::add",this.paths);
}

OmDataObj.prototype.remove = function(path)
{
  this.paths = $.grep(this.paths,function(elem,index){
    return elem !==path;
  });
  console.log("OmDataObj::remove",this.paths);
  
}


OmDataObj.prototype.get = function()
{
  console.log("OmDataObj::get",this.paths);
  
  this.myurl = "server/serve_hists.cgi"; // Note relative url.
  this.param = $.param({
    filename: this.file,
    hists: this.paths.join(':'),
    options: "-",
    });

  var self = this;
  $.ajax({
          type: "GET",
          url: this.myurl,
          data: this.param,
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          async: true,
          error:    function(){self.QueryError()},
          success:  function(data,textStatus,jqxhr){self.QuerySuccess(data,textStatus,jqxhr)},
        }); 
  this.status = "getting";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
}

OmDataObj.prototype.QueryError = function()
{
  this.status = "error";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
}

OmDataObj.prototype.QuerySuccess = function(data,textStatus,jqxhr)
{
  this.status = "success";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
  this.data = data;
  if(data.error) {
    this.status = error;
    console.warn("Got error when retrieving data"+data.error);
    $.event.trigger({
      type: "OmDataError",
      msg: "Backend error: "+data.error
    }) ;
    return;
  }

  console.log("triggering");
  $.event.trigger({type: "OmDataRecieved"}) ;

}

