#!/usr/bin/perl -w
use CGI qw/:standard/;

#
# Script to take in an uploaded XML file and simply echo it back to the requester.
#

sub myerror
{
  # subroutine to print errors to json stream
  print header(-type => 'application/json',
               -Access_Control_Allow_Origin => "*");
  my $err = shift();
  print encode_json({serve_event_log=> $msglog, error => $err});
  exit;
}

print header(-type => 'application/json',
               -Access_Control_Allow_Origin => "*");

if(!defined param('thefile')) {
  myerror("echoFile.cgi: no input data!");
}

open(LOCAL,">lastecho.json");

my $upload_filehandle = upload('thefile'); 
while(<$upload_filehandle>) { 
  print $_; 
  print LOCAL $_;
}
