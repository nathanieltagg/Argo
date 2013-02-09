#!/usr/bin/perl -w
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use ArachneServerTools;

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This version is cleverer from _inline: it uses a running root session
# and makes a request via sockets!
#

print header(-type => 'text/xml',
             -Access_Control_Allow_Origin => "*");

print '<?xml version="1.0" encoding="ISO-8859-1"?>';
print "<serving>";
print "<serve_event_logging><![CDATA[";

# defaults of configuration
my $det = "TP";
my $ver = "v6r2p1";
my $run=580;
my $subrun=4;
my $gate=1;


if( -r "server_config.pl" ) {
    require "server_config.pl";
}  



my $pathglob ="";
my $selection = "1";
my $entrystart = 0;
my $entryend = 1000000000;

# decompose query string.
if(defined param('gate')) {
    $gate = param('gate');
    $selection = "ev_gate==$gate";
}

if(defined param('selection')) {
    $selection=param('selection');
}

if(defined param('entry')) {
    $entrystart=param('entry');
}


if(defined param('filename')){
    # 
    # Requested a DST file.
    #
    $pathglob=param('filename');
} 
else #elsif( defined param('run') && defined param('subrun') && defined param('gate') )
{
    # 
    # Requested a specific run, subrun, gate
    # from official DSTs.
    #
    if( defined param('run')    ) {$run = param('run');       }
    if( defined param('subrun') ) {$subrun = param('subrun'); }
    if( defined param('ver')    ) {$ver = param('ver'); }
    if( defined param('det')    ) {$det = param('det'); }

    my @paths_to_check = ("./");
    my $fileglob = "";
    if($ver eq "v6r2p1") {
      push @paths_to_check,"/minerva/data/data_processing/numib/Run_$run/dst/";
      
      $fileglob = $det . "_" . sprintf("%08d",$run) . "_" . sprintf("%04d",$subrun) 
        . "_" . "*" . "_" . $ver . ".root";

    } else {

      ## default to v7 pathname.

      # full 8-digits of run number
      my $longrun = sprintf("%08d",$run);
      my $r1 = substr $longrun, 0, 2;
      my $r2 = substr $longrun, 2, 2;
      my $r3 = substr $longrun, 4, 2;
      my $r4 = substr $longrun, 6, 2;
      
      $fnal_path = "/minerva/data/data_processing/prototype/dst/numib/" 
			.$ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;

      $fnal_path = "/minerva/data/data_processing/downstream/dst/numib/"
        . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;

      $fnal_path = "/minerva/data/data_processing/minerva/dst/numip/"
        . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;

      $fnal_path = "/minerva/data/data_processing/minerva/dst/numibeam/"
        . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;

      $fnal_path = "/minerva/data/data_processing/downstream/dst/numibeam/"
        . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;

      $fnal_path = "/minerva/data/data_processing/downstream/prongs/numib/"
        . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
      push @paths_to_check,$fnal_path;


      $fileglob = $det . "_" . $longrun . "_" . sprintf("%04d",$subrun) 
         . "_" . "*" . "_DST_" . $ver . ".root";

      if($det =~ /^SIM/) {
        $fnal_path = "/minerva/data/mc_production/minerva/dst/"
         . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
        push @paths_to_check,$fnal_path;
        $fnal_path = "/minerva/data/mc_production/frozen/dst/"
         . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
        push @paths_to_check,$fnal_path;
        $fnal_path = "/minerva/data/mc_production/prototype/dst/"
         . $ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
        push @paths_to_check,$fnal_path;

        $fileglob = $det . "*_" . $longrun . "_" . sprintf("%04d",$subrun) 
           . "_" . "*" . "_DST_" . $ver . ".root";

      }
      
         

     }

    # Try bluearc, then try the current directory.
    # This allows local files for testing.
    $pathglob = "";
    foreach $p (@paths_to_check) {
      $pathglob .= "$p/$fileglob ";
    }
}

my $print_pathglob = $pathglob;
$print_pathglob =~ s/ /\n<br\/>\n/g;
print "serve_event.cgi looking in pathglob: $print_pathglob\n<br/>\n";

@files_raw = glob($pathglob);
@files = ();
#
# Remove some false-positives from the fileglob.
#
if(!defined param('filename')) {  # Don't cut if we specifically requested the file.
  foreach $file (@files_raw)
  {
    next if( $file =~ /_IDODDigits_DST_/ );
    push @files, $file;
  }
} else {
 @files = @files_raw;
}

if((@files)==0) {
    ArachneServerTools::myerror("Couldn't find file for this event specification.");
}

print "serve_event.cgi found " . scalar(@files) . " files\n<br/>\n";

$filename = $files[0];

my $resp = ArachneServerTools::request($filename,$selection,$entrystart,$entryend);

print "]]></serve_event_logging>";
print $resp;
print "</serving>";
