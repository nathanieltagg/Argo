#!/usr/bin/perl -w
use CGI qw/:standard/;

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This version simply launches a ROOT session to do it's bidding, which is not
# the fastest - better would be to send a query to a running server
# which would not need to launch (or even open files in some cases).

sub myerror
{
  my $err = shift();
  print '<?xml version="1.0" encoding="ISO-8859-1"?>';
  print '<gate><error>';
  print $err;
  print '</error></gate>';
  exit;
}

print header('text/xml');

#set up ROOT environment.
$ENV{"ROOTSYS"}="/root/pro";
$ENV{"LD_LIBRARY_PATH"}='LD_LIBRARY_PATH=$ROOTSYS/lib';

# decompose query string.
my $run=580;
my $subrun=4;
my $gate=12;


if( defined param('run') && defined param('subrun') && defined param('gate') )
{
  $run = param('run');
  $subrun = param('subrun');
  $gate = param('gate');
}

my $det = "TP";
my $ver = "v6r2p1";
$fileglob = $det . "_" . sprintf("%08d",$run) . "_" . sprintf("%04d",$subrun) 
          . "_" . "*" . "_" . $ver . ".root";

#print $fileglob . "\n";
@files = glob($fileglob);
if((@files)==0) {
    myerror("Couldn't find file matching $fileglob");
}
$filename = $files[0];
#print $filename . " " . $gate . "\n";

# compose flags for script execution.
my $args = "make_xml.C+\\(\\\"$filename\\\",$gate\\)";
#print $args . "\n";
my $cmd = '$ROOTSYS/bin/root -q -b ' . $args . " 2>&1 |";
#print $cmd . "\n";
my $result;
open(INPUT,$cmd);
{
  local $/=undef;
  $result = <INPUT>;
}
close(INPUT);

# Check outout. Is there XML present?  Strip off header and attach seperately.
if( $result =~ s/^(.*)(\<\?xml)/$2/s ) { 
  #print "Got XML:" . "\n";
  print $result;
} else {
  #print "Not got XML" . "\n";
  myerror($result);
}
