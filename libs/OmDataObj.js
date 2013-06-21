

var gCurFile = "current.root";

function OmDataObj(path)
{
  this.path = path;
  this.cur_cycle = "";
  this.file = gCurFile;
  this.status = "uninitialized";

  
}

OmDataObj.prototype.callback_error = function()
{}
OmDataObj.prototype.callback_newdata = function()
{}


OmDataObj.prototype.get = function()
{
  var myurl = "server/serve_hists.cgi"; // Note relative url.
  var param = $.param({
    filename: this.file,
    hists: this.path,
    options: "-",
    });

  var self = this;
  $.ajax({
          type: "GET",
          url: myurl,
          data: param,
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          async: true,
          error:    function(){self.QueryError()},
          success:  function(data,textStatus,jqxhr){self.QuerySuccess(data,textStatus,jqxhr)},
        }); 
  this.status = "getting";
}

OmDataObj.prototype.QueryError = function()
{
  this.status = "error";
  this.callback_error();
}

OmDataObj.prototype.QuerySuccess = function(data,textStatus,jqxhr)
{
  this.status = "success";
  this.data = data;
  if(data.error) {
    this.status = error;
    console.warn("Got error when retrieving data"+data.error);
    this.callback_error();
    return;
  }
  this.callback_newdata();
}

