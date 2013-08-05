#!/usr/bin/perl -w
# use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
# use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
use MongoDB;
use Data::Dumper;
use JSON;


# my $q = CGI->new;
# $db    = $q->param("db");
# $query = $q->param("query");

my $client     = MongoDB::MongoClient->new(host => 'localhost', port => 27017);
my $database   = $client->get_database( 'mydb' );
my $collection = $database->get_collection( 'testData' );
my $id         = $collection->insert({ some => 'data' });
#my @data       = [$collection->find_one({ _id => $id })];
 my @data       = [$collection->find()->all];
# my $result =  $data->all;

print Dumper(@data);
print "\n\n";
$json = JSON->new;
$json->allow_blessed(1);

print $json->encode(@data);
