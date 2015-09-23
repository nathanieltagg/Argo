#!/usr/bin/perl -w

use LWP::UserAgent;
use CGI;

my $q = CGI->new;
my $query =  $q->query_string();

my $ua = LWP::UserAgent->new;
$ua->timeout(10);
$ua->env_proxy;

my $url = 'http://ubdaq-prod-near2/Argo/server/slomoncom_get.cgi';

if(defined $query){ $url .= "?"; $url .= $query }

  
my $response;
if( $q->request_method() eq "GET" ) {
  $response = $ua->get($url);  
} else {
  %params = $q->Vars;
  $response = $ua->post($url, \%params);  
  
}
               
 if ($response->is_success) {
    print  "Content-type:application/json\r\n";
    print  "charset: UTF-8\r\n";
    print  "Access-Control-Allow-Origin: *\r\n";
    if($response->header('Content-Encoding')) {
      print  "Content-Encoding: " .$response->header('Content-Encoding'). "\r\n";
      
    }
    # print $oldout "Content-Length: $size\r\n";
    print "\r\n";            
   print $response->content;  # or whatever
 
 } else {
   print $q->header;
   print $url . "\n";
   print $response->status_line;  
 }
 
