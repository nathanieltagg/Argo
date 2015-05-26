#!/usr/bin/perl -w
use strict;
use warnings;
use CGI qw/:standard/;
use CGI::Carp qw(fatalsToBrowser);
use URI::Escape;

#
# Script to take in an uploaded XML file and simply echo it back to the requester.
#
my $q = new CGI;

print $q=header;

if(defined param('data') && defined param('file'))
{
  my $file = param('file');
  # Allow only alphabetic, numeric, dash, dot, underscore
  $file =~ s/[^A-Za-z0-9\_\-\.]//g;
  # explicity remove double-dot
  $file =~ s/\.\.//g;
  # explicity remvoe slashes
  $file =~ s/\///g;
  
  $file = "/uboone/data/users/tagg/argofeedback/" . $file;
  open(FILE,">$file");
  print FILE param('data');
  close(FILE);
  print "Yup. Saved in file " .  uri_escape($file); # XSS killer
} else {
  print "Nope.";
}
