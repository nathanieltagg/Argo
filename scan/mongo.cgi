#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;

my $q = CGI->new;
$db    = $q->param("db");
$query = $q->param("query");

# This won't work.
# INstead, try to echo things to Dromedary:

# use LWP::UserAgent; 
# my $ua = new LWP::UserAgent;
# 
# my $response 
# = $ua->post('https://www.example.com/submit.cgi', 
# { param1 => 'value1', 
# param2 => 'value2', 
# });
# 
# my $content = $response->content; 

# or, more simply:
# $result = `curl -d 'your params' secureURL`; 

#$system("~/mongo/bin/mongo localhost:27017/$db --quiet --eval \"$query\"");
