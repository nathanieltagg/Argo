function hello()
{
  print("Hi there");
}

var mapLeaderboard = function() {
  emit(this.user_name, this._id);
}

var reduceLeaderboard = function(key,value) {
  return value.length;
}


var mapUnique = function() {
  var key = { user_name: this.user_name, 
              recoVer: this.recoVer, 
              run:     this.run, 
              subrun: this.subrun, 
              gate: this.gate,
              slice: this.slice
            };
  var val = { id: this._id, time: this.modification_date}; 
  emit(key,val);
}

var reduceUnique = function(key,values) {
  var which =values[0].id;
  var earliest = new Date(values[0].modification_date);
  for(var i=1;i<values.length;i++) {
    var date = new Date(values[i].modification_date);
    if(date<earliest) { earliest = date; which = values[i].id}
  }
  return {id: which, date: date};
}


//db.tscans.mapReduce( mapLeaderboard, reduceLeaderboard, {out: "leaderboard"});
db.tscans.mapReduce( mapUnique, reduceUnique, {out: "unique"});
