#!/usr/bin/perl -w
use CGI qw/:standard/;

#
# Script to take in an uploaded XML file and simply echo it back to the requester.
#

sub myerror
{
    my $err = shift();
    print '<?xml version="1.0" encoding="ISO-8859-1"?>';
    print '<gate><error>';
    print $err;
    print '</error></gate>';
    exit();
}

print header('text/xml');

if(!defined param('thefile')) {
  myerror("echoFile.cgi: no input data!");
}

open(LOCAL,">lastecho.xml");

my $upload_filehandle = upload('thefile'); 
while(<$upload_filehandle>) { 
  print $_; 
  print LOCAL $_;
}
