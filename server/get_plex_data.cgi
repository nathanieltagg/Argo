#!/usr/bin/perl -w

use DBI;
use CGI qw/:standard/;
use JSON;# qw(encode_json to_json);

our $msglog;
our $oldout;
our $olderr;


sub myerror
{
  $err = shift;
  print $oldout encode_json({serve_event_log=> $msglog, error => $err}); 
  exit;
}

# Before we begin, capture all the usual stdout stuff and stuff it into a variable, so we can ship it inside the JSON.
open($oldout, ">&STDOUT") or die "Can't dup STDOUT: $!";;
open($olderr, ">&STDERR") or die "Can't dup STDERR: $!";;
close STDOUT;
open(STDOUT, ">", \$msglog);  
open(STDERR, ">", \$msglog);


# subroutine to print errors to json stream
print $oldout header(-type => 'application/json',
             -Access_Control_Allow_Origin => "*");

$dbh = DBI->connect("dbi:Pg:host=localhost;port=5432","tagg") or myerror("Could not open DB.");

$sth = $dbh->prepare("SELECT * FROM channels NATURAL JOIN asics NATURAL JOIN motherboards NATURAL JOIN coldcables NATURAL JOIN motherboard_mapping NATURAL JOIN intermediateamplifiers NATURAL JOIN servicecables NATURAL JOIN servicecards NATURAL JOIN warmcables NATURAL JOIN ADCreceivers NATURAL JOIN crates NATURAL JOIN fecards;");
$sth->execute();

# iterate through resultset
# print values
my $fields = $sth->{NAME};
$plexus = "{ \"fields\":[" . join(",",map { qq/"$_"/ }@$fields) . "],"; 
$plexus .= " \"data\":[";
$n=0;
while(my $ref = $sth->fetchrow_arrayref()) {
  if($n!=0) { $plexus .= ","; };
  $n++; 
  # $plexus .= "[" . join(",",map { qq/"$_"/ }@$ref) . "]";
  $plexus .= to_json($ref);
}
$plexus .= "]}";
# clean up
$dbh->disconnect();

print $oldout '{';
print $oldout '"plexus":';
print $oldout $plexus;
print $oldout '}';