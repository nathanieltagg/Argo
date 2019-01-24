#!/usr/bin/perl -w

#
use DBI();
use MongoDB;

#Load configuration.
#print "Reading configuration from sql_config.pl\n";
$db = $user = $host = $pass = "";

$db   = "arachne";
$host = "localhost";
$user = "tagg";
$pass = "";

$dbh = DBI->connect("DBI:mysql:database=$db;host=$host","$user", "$pass",{'RaiseError' => 1});

my $client     = MongoDB::MongoClient->new(host => 'localhost', port => 27017);
my $database   = $client->get_database( 'mydb' );
my $collection = $database->get_collection( 'tscans' );
# my $id         = $collection->insert({ some => 'data' });
# my $data       = $collection->find_one({ _id => $id });
$res = $dbh->selectall_arrayref("select * from tscans",{ Slice => {} });

for $ref (@$res) {
  $collection->insert($ref);
}
