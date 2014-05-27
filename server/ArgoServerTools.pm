#!/usr/bin/perl -w

package ArgoServerTools;

use Time::HiRes qw( gettimeofday tv_interval );
use CGI qw/:standard/;
use POSIX qw(setsid);
use IO::Socket;
use IO::Select;
use Cwd;
use Encode qw(encode_utf8);
use IO::Compress::Gzip qw(gzip $GzipError) ;

use JSON qw(encode_json);
use Exporter 'import';
@EXPORT = qw(setup myerror serve request); # symbols to export


our $ntuple_server_port = 9092;
our $ntuple_server_host = 'localhost';
our $exec_name = 'argo-backend';

do("../config/server_config.pl"); #|| die; # load file if present.


our $msglog;
our $oldout;
our $olderr;

sub setup
{
  # Before we begin, capture all the usual stdout stuff and stuff it into a variable, so we can ship it inside the JSON.
  open($oldout, ">&STDOUT") or die "Can't dup STDOUT: $!";;
  open($olderr, ">&STDERR") or die "Can't dup STDERR: $!";;
  close STDOUT;
  open(STDOUT, ">", \$msglog);  
  open(STDERR, ">", \$msglog);
  print "testing\n";
}

sub serve
{
  # print to the stored version of $stdout to actually get it out the door.
  # Note that we encode everything that nominally went to stdout/stderr and ship it as the 'serve_event_log'.


  #package and manually gzip. 
  $msglog =~ s/\n/\<br\/\>/g;
  
  my $serving = '{"record":' . $_[0] . ',"serve_event_log":"' . encode_utf8($msglog) . '"}';
  my $zipped = ""; 
  
  my $start_time =  Time::HiRes::gettimeofday();
  
  # zip it.
  open($serving_fh, '<', \$serving);
  open($zipped_fh, '>' , \$zipped);
  gzip $serving_fh => $zipped_fh, -Level=>9
         or die "gzip failed: $GzipError\n";
         
         
 my $zip_time =  Time::HiRes::gettimeofday();
         
  print main::PROFLOG "Time to gzip: " . ($zip_time - $start_time) . "\n";

  my $size = length($zipped);
  my $head = header(-type => 'application/json',
                     -charset => "UTF-8",
                     -Access_Control_Allow_Origin => "*",
                     -Content_Encoding => 'gzip',
                     -Content_Length => $size);
   if($_[1]>0) {
     $head = header(-type => 'application/json',
                         -charset => "UTF-8",
                         -Access_Control_Allow_Origin => "*",
                         -Content_Length => $size,
                         -Content_Encoding => 'gzip',                         
                         -attachment => 'event.json'
                         );
 }
 print $oldout $head;
 print $oldout $zipped;
 close $oldout;
 
  # estimate total length.
  # my $thing1 = '{';
  # $thing1 .= '"record":';
  # 
  # $msglog =~ s/\n/\<br\/\>/g;
  # my $thing2 = ',"serve_event_log":"';
  # $thing2 .= encode_utf8 "$msglog";
  # $thing2 .= '"}';
  # 
  # my $size = length($thing1) + length($_[0]) + length($thing2);
  # 
  # 
  # my $headertype = 'application/json';
  # my $head = header(-type => 'application/json',
  #                   -charset => "UTF-8",
  #                   -Access_Control_Allow_Origin => "*",
  #                   -Content_Length => $size);
  # if($_[1]>0) {
  #   $head = header(-type => 'application/json',
  #                       -charset => "UTF-8",
  #                       -Access_Control_Allow_Origin => "*",
  #                       -Content_Length => $size,
  #                       -attachment => 'event.json'
  #                       );
  # }
  # print $oldout $head;  
  # print $oldout $thing1;
  # print $oldout $_[0];
  # print $oldout $thing2;
  # 
  # #trick: see if closing STDOUT will force the session to end.
  # close $oldout;
}

sub myerror
{
  # subroutine to print errors to json stream
  print $oldout header(-type => 'application/json',
               -Access_Control_Allow_Origin => "*");
  my $err = shift();
  print $oldout encode_json({serve_event_log=> $msglog, error => $err});
  exit;
}

sub kill_running_server
{
  print "Killing any running $exec_name process.\n";
  # kill any existing service, if PID file exists.
  if( -r "$exec_name.pid" ) {
      my $pid = `cat $exec_name.pid`;
      print "Found pid file with value $pid \n";
      unless(kill(9,$pid))
      {
        print "Could not signal that process.\n";
      }
      if(kill(0,$pid)) {
        print "The process still freaking exists. I don't know how to kill it.\n"
      } else {
        print "Looks like it's dead, Jim.\n";
      }
  }
  
}

sub start_server
{
  print "Starting up a new $exec_name process.\n";
  # fork off a new process.
  my $pid = fork();

  if(not defined $pid) {
      myerror("couldn't fork!");
  } elsif($pid==0) {
    # This is the forked process.
    
      $ROOTSYS="../backend/root";
      $BOOSTSYS="../backend/boost";
      $ENV{"ROOTSYS"}="$ROOTSYS";
      $ENV{"BOOSTSYS"}="$BOOSTSYS";
      $ENV{"LD_LIBRARY_PATH"}="$ROOTSYS/lib:$BOOSTSYS/lib";
      $ENV{"DYLD_LIBRARY_PATH"}="$ROOTSYS/lib:$BOOSTSYS/lib";

      setsid();
      rename "$exec_name.log.4", "$exec_name.log.5";
      rename "$exec_name.log.3", "$exec_name.log.4";
      rename "$exec_name.log.2", "$exec_name.log.3";
      rename "$exec_name.log.1", "$exec_name.log.2";
      rename "$exec_name.log",   "$exec_name.log.1";
      unlink "$exec_name.log";
      open (STDIN,  '</dev/null');
      open (STDOUT, ">$exec_name.log");
      open (STDERR, '>&STDOUT');
      print "Starting a new job...<br/>\n";

      print "Environemnt...\n";
      system("bash -c 'set' >>$exec_name.log 2>&1");
  #     my $pid = getppid();
  #     # system("echo $pid > ntuple-server.pid");
  #     # my $pwd = getcwd;
  #     # system("echo $pwd >> ntuple-server.pid");
  #     # print  $pwd . "\n";
      my $cmd = "../backend/$exec_name $ntuple_server_port >>$exec_name.log 2>&1";
      if( -r "../backend/setup.sh ") { $cmd = "source ../backend/setup.sh; " . $cmd; }
      print "Running: $cmd\n";
      $val = system($cmd);
      $pid = $!;
      # unlink "ntuple-server.pid";
      exit($val);
  }
}


sub get_sock
{
  my $sock = new IO::Socket::INET( 
    PeerAddr => $ntuple_server_host,
    PeerPort => $ntuple_server_port,
    Proto => 'tcp',
    );

  if(!$sock) {
    print "get_sock() error: $!\n";
  }
  
  return $sock;
}


sub request
{
  my $time_start = [gettimeofday];
  my $filename = shift() || "NO_FILENAME_SPECIFIED";
  my $selection = shift() || 1;
  my $entrystart = shift() || 0;
  my $entryend = shift() || 0;
  my $options = shift || "none";

  #Cover up some possible blanks by user or upstream error.
  if($entrystart eq "") { $entrystart = "0"; };
  if($selection eq "") { $selection = "1"; };
  if($entryend eq "") { $entryend = "0"; };

 
  print "<br/>ArachneServerTools::request() $filename $selection $entrystart $entryend $options\n<br/>";
  print "From host: $ntuple_server_host port $ntuple_server_port\n<br/>";
  
  
  #Is there an open root session?
  my $sock = get_sock();

  RESTART:

  if(! $sock) {
    kill_running_server();
    start_server();
    
    print "Looking for socket on newly restarted process.\n";
    my $startup_timeout_tries = 10;
    
    my $startup_time = 0;
    while($startup_time < $startup_timeout_tries) {
      sleep(1);
      print "Trying...";
      undef $sock;
      $sock = get_sock();
      last if ($sock); # exit if we have it.
      $startup_time++;
    }

    print "Finished looking for socket. Do I have it?\n";
    if($sock) {print "Yes\n";}
    else {print "No.\n";}
    
    myerror("Could not create socket\n") unless $sock;   
  }

  print $sock "$options,$filename,$selection,$entrystart,$entryend\n";

  # print ("Query made.\n");

  # now wait to see if we get anything on the socket
  my $timeout_seconds = 100;
  
  $sel = IO::Select->new();
  $sel->add($sock);
  
  @ready = $sel->can_read($timeout_seconds);
  if(@ready) {
    $time_start_req = [gettimeofday];
    # print REQUESTLOG "Got a read hit.\n";
    $result = "";
    # while(<$sock>) {
    #   # print REQUESTLOG "Got " . length($_) . " bytes\n";
    #   $result .= $_;
    #   print "Got data chunk at time: " . tv_interval( $time_start_req, [gettimeofday])*1000 . " ms\n<br/>";
    # }
    
    # This version is not as robust as the above one 
    #  (e.g. pretty-print might clobber it) 
    #  but it returns considerably faster! Somehow, waiting for the socket to 
    #  close in that while() loop can take many seconds!
    $result = <$sock>;
    # print REQUESTLOG "Socket finished with total " . length($result) . " bytes\n";
    
    print "Got result from ntuple-server. Length: " . length($result) . " bytes\n<br/>";
    print "Time to send query:   " . tv_interval( $time_start, $time_start_req)*1000 . " ms\n<br/>";
    print "Time to get response: " . tv_interval( $time_start_req, [gettimeofday])*1000 . " ms\n<br/>";
    
    return $result;
  } else {
    #looks like the server had problems. restart.
    undef $sock;
    print "The server took longer than timeout ($timeout_seconds) to give a response, so I'm restarting the process.\n";
    
    goto RESTART;
  }

 
}

1;
