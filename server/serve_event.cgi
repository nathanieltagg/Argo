#!/usr/bin/perl -w
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use Cwd;
use File::Spec;
use URI::Escape;
use ArgoServerTools qw(setup myerror);

#
# Script to get a an event from a root-file DST as an XML object.
# 
# This version is cleverer from _inline: it uses a running root session
# and makes a request via sockets!
#

my $start_time = Time::HiRes::gettimeofday();


ArgoServerTools::setup();



if( -r "server_config.pl" ) {
    require "server_config.pl";
}  

my $pathglob =""; # Default event.
my $selection = "1";
my $entrystart = 0;
my $entryend = 1000000000;

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
    $pathglob=uri_unescape(param('filename'));
} 

#raw:

if(param('what') eq 'raw') {
  my $run = param('run')||0;
  my $subrun = param('subrun') || 0;
  
  # full 8-digits of run number
  my $longrun = sprintf("%08d",$run);
  my $longsubrun = sprintf("%05d",$subrun);
  my $ver = param('ver') || 'v6_00_00';

  my $r1 = substr $longrun, 0, 2;
  my $r2 = substr $longrun, 2, 2;
  my $r3 = substr $longrun, 4, 2;
  my $r4 = substr $longrun, 6, 2;
  my $fnal_path = "/pnfs/uboone/data/uboone/raw/online/assembler/"
                    .$ver."/" .$r1."/" .$r2."/" .$r3."/" .$r4;
  
  $longrun = sprintf("%07d",$run); #filename has only 7
  $pathglob = $fnal_path . "/*-$longrun-$longsubrun.ubdaq";
}

my $print_pathglob = $pathglob;
$print_pathglob =~ s/ /\n<br\/>\n/g;
print "serve_event.cgi looking in pathglob: $print_pathglob\n<br/>\n";

@files_raw = glob($pathglob);

# This is a good place to remove some false-positives from the fileglob:
@files = @files_raw;

if((@files)==0) {
    myerror("Couldn't find file for this event specification.");
}

$filename = $files[0];
$absolute_filename = File::Spec->rel2abs($filename);
print "File is $absolute_filename\n<br>";

if(!( -e $absolute_filename )) {
    myerror("File does not exist: $absolute_filename");
}

if(!( -r $absolute_filename )) {
    myerror("File is not readable: $absolute_filename");
}

if($absolute_filename =~ /^\/pnfs\//) {

  # Mounted in pnfs space. Check to make sure file is extant.
  print "Checking status.\n</br>";
  my($vol,$dir,$file) = File::Spec->splitpath($absolute_filename);
  # See email from Kirby, May 25 2016
  #  If you want to use a file...
  #    lar -c my.lar /pnfs/uboone/data/uboone/yaddayaddayadda.root
  #  You can check dcache status with:
  #   $> cat /pnfs/uboone/data/uboone/'.(get)(yaddayaddayadda.root)(locality)'
  # ONLINE_AND_NEARLINE
  # means that it is on disk (ONLINE) and on tape (NEARLINE)
  # if it's only "NEARLINE" that means it's on tape.

  $dcache_status_file = File::Spec->catpath($vol,$dir, ".(get)($file)(locality)");
  print "Checking $dcache_status_file\n</br>";
  if(open( $dcache_handle, "<" , $dcache_status_file)){
    $status = <$dcache_handle>;
    if(defined($status)) {
      print "PNFS file status = $status\n</br>";
      if($status =~ /ONLINE/) {
        print "File is online.\n</br>";
      } else {
        system("head -c 1 $absolute_filename &");
        #FIXME: do something the javascript hand handle.
        myerror("UNSTAGED - The file you requested is in tape storage. It's being fetched now; please reload in 30 seconds or so.");
      }
    }
  }
}

my $resp = ArgoServerTools::request($absolute_filename,$selection,$entrystart,$entryend,param('options'));

my $req_time = Time::HiRes::gettimeofday();


my $download=0;
if(defined param('download')) { $download = 1; }

ArgoServerTools::serve($resp,$download);

my $serve_time =  Time::HiRes::gettimeofday();

print ArgoServerTools::PROFLOG "Time to req: " . ($req_time - $start_time) . " time to serve: " . ($serve_time - $req_time) . "\n";

#remove old log files, more than 1/2 day old.
for ( glob "argo_backend*.log" ) {
  unlink $_ if ( -M $_ > 0.5 );
}

