#!/usr/bin/perl -w

# use CGI::Session;
use CGI::Pretty qw(:standard *div *table);
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
use File::Spec;

my $cgi = $CGI::Q;

sub sanitize_number {
	$val = $_[0];
	$val =~ s/[^0-9]//g;
}

$|=1;

use File::Basename;
chdir( dirname(__FILE__) ); # cd to directory of this script.


# $samweb = "/grid/fermiapp/products/common/prd/sam_web_client/v2_0/NULL/bin/samweb -e uboone ";
# easier in this deployment, since the enviroment is set up correctly outside the NODE caller.
$samweb = "samweb -e uboone";

# copy URL params into post, if there are both
for my $p (url_param){
	param(-name=>$p, -value=>url_param($p));
}

# my $session = new CGI::Session("driver:sqlite", $cgi, {DataSource=>'./sessions.sql'})
#                    or die CGI::Session::errstr;

$title = 'SamWebSpider ';
if(param("file")) { $title .= param('file');  $title =~ s/[^A-Za-z0-9._ ]*//g;}
elsif(param("def"))  { $title .= param('def');  $title =~ s/[^A-Za-z0-9._ ]*//g;}
elsif(param("def_starts_with"))  { $title .= param('def_starts_with'); $title =~ s/[^A-Za-z0-9._ ]*//g;}

print header . 
	CGI::start_html( -title=>$title, 
					 -style=>[ {-src=>"samspider.css",-media=>'all'}
					 	     , {-src=>"https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/themes/smoothness/jquery-ui.css",-media=>'all'}
					 	], 
					 -script=>[ {-type => 'text/javascript', -src => "https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js"}
					 		  , {-type => 'text/javascript', -src => "https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js"}
					 		  , {-type => 'text/javascript', -src => "samspider.js"}
					          ],
					 -head=>Link({-rel=>'icon', -type=>'image/png', -href=>'../images/icon.png'})
					  );
print h1("SamSpider");

if(param("file")) {
  $samfile = param("file");
  $samfile  =~ s/[^A-Za-z0-9.-_ ]*//g; 
  $absolute_filename = "";
  $dirname = "";
  my $cmd = "$samweb locate-file $samfile";
	print comment($cmd);
	open(my $fh, "$cmd |") or die "Can't open samweb. Contact Nathaniel";
  $n = 0;
	while(	$samloc = <$fh> ) {
    print "location: " . $samloc . br;
    $n++;
		if($samloc =~ /^enstore/) {
			$dirname = ($samloc =~ /(\/.*)\(/)[0];			
		}

	}
  if($n==0) { print p("<b>Couldn't find any file location for this file.  SAM doesn't know where it is, if it exists.</b>")};
  
  if(length($dirname)>0) {
  	$absolute_filename = $dirname . "/" . $samfile;
  	print "File location is" . br;
  	print pre($absolute_filename);
  }

	$status = "NEARLINE";

	if($absolute_filename =~ /^\/pnfs\//) {
	  # Mounted in pnfs space. Check to make sure file is extant.
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
	  print comment("Checking $dcache_status_file");
	  if(open( $dcache_handle, "<" , $dcache_status_file)){
	    $status = <$dcache_handle>;
	    if(defined($status)) {
	      print "File status = $status ";
	      if($status =~ /ONLINE/) {
	        print "-- File is staged and ready to read." .br;
	        print a({-href=>"/#filename=$absolute_filename&entry=0"},"Click here to see in Argo.");
	      } else{
	      	if(param("stage")) {
		        system("head -c 1 $absolute_filename &");
		        print "-- File is on tape, now being staged to disk. Please wait." .br;
		        print "<script type='text/javascript'>setTimeout(function(){window.location.reload(true);},30000);</script>";	      		
	      	} else {
            print p("-- This file is NOT on the disk cache, it's on tape only.");
	      		print a({-href=>"?file=$samfile&stage=1"},"Click here to stage this file to disk.");
	      	}
	      }
	    }
	  }
	} else {
    if(length($absolute_filename)>0) {
    		print a({-href=>"../argo.html#filename=$absolute_filename&entry=0"},"Click here to see in Argo.");
    }
	}

	if(param("show_metadata")) {	
		print br.br;
		print "<b>File Metadata:</b>" . br;
		open(my $fh, "$samweb get-metadata $samfile |") or die "Can't open samweb. Contact Nathaniel";
		print start_div({-class=>"samweb_metadata"});
		print "<pre>";
		while(my $line = <$fh>){
			print $line;
		}
		print "</pre>";
		print end_div;
	} else {
		print br.br;
		print a({-href=>"?file=$samfile&show_metadata=1"},"Click here to get file metadata.");
	}




} elsif(param('def')) {
	# Definition defined.  List files.

	$nbatch = 50; # results to show on one page.

	my $definition = param('def');
	$title =~ s/[^A-Za-z0-9.-_ ]*//g;
	print h3("Using data defintion: " . $definition);

	open(my $fh, "$samweb count-files \"defname: $definition\" |") or die "Can't open samweb. Contact Nathaniel";
	$line = <$fh>;
	chomp $line;
	print p("This dataset definition has $line files in total.");
	
	print start_div({-class=>"extra_query_params"});
	print "You can narrow your query to find a file with these boxes:";
	print start_form(-method=>'GET');
	print hidden(-name=>"def",-value=>$definition);
	print label("Run ",textfield(-name=>'run', -value=>param('run')||'', -size=>8));
	print label("Subrun ",textfield(-name=>'subrun', -value=>param('subrun')||'', -size=>8)) . br;
	print label("Date",textfield(-class=>'datepicker', -name=>'date', -value=>param('date')||'', -size=>12));
	print label("Time",textfield(-name=>'time', -value=>param('time')||'14:01:00', -size=>12));
	print br;
	print label("Min Size",textfield(-name=>'minsize', -value=>param('minsize')||'', -size=>12));
	print "(Files smaller than 1000000 usually have zero events.)";
	print br;
	print submit;
	print end_form;
	print end_div;

	$query = "defname:$definition";
	if(param('minsize')) { $query .= " and file_size > " . sanitize_number(param('minsize')) }
	if(param("run")) { $query .= " and run_number=" . sanitize_number(param("run")); }
	if(param("run") && param("subrun")) { $query .= " and run_number=" . sanitize_number(param("run")). "." . sanitize_number(param("subrun")); }
	if(param("date")) {
		$datestr  = param("date");
		$datestr =~ s/[^0-9-]*//g; 
		$timestr  = param("time");
		$timestr =~ s/[^0-9:]*//g; 
		$d = "'" . $datestr . 'T' . param('time') . "'";
		$query .= " and start_time<=" . $d . " and end_time>" . $d; 
	}

	my $nskip = sanitize_number(param("skip")) || 0;
	if(param("skip")) { $query .= " with offset " . $nskip; }
	$query .= " with limit $nbatch";

	print "<pre>Query: $query</pre>" . br;
	# print comment("$samweb list-files \"$query\" ");
	open($fh_files, "$samweb list-files \"$query\" |") or die "Can't open samweb. Contact Nathaniel";

	if(param("skip")) {
		$prevskip = $nskip-$nbatch;
		if($prevskip<0) { $prevskip = 0; }
		print a({-href=>"?def=$definition&skip=$prevskip"},"< Previous $nbatch files") . br;
	}
	print start_div({-class=>"samweb_files"});
	my $n = 0;
	while($line = <$fh_files>) {	
			$n++;	
			# print comment($line);
			my $lineno = $n + $nskip;
			chomp $line;
			print $lineno . " " . a({-href=>"?file=$line"},$line) . br;
	}
	$nextskip = $nskip + $nbatch;
	close($fh);
	print end_div;
	print br;
	if($n==$nbatch) { print a({-href=>"?def=$definition&skip=$nextskip"},"> Next $nbatch files") . br; }
	# print "$n files total.";

	

} else {


        # No definition set defined. Give the user options.
        print h3("Click through the list below to find your desired dataset defintion.");
        my $def_prefix = param("def_starts_with") || "";
        $def_prefix =~ s/[^0-9a-zA-Z._]*//g; 
        print start_div({-class=>"samweb_definitions"});
		system("./samdef-organizer $def_prefix");
		print end_div;
        print h3("Links to some useful definitions");
        if(open(my $fh, '<', 'interesting_defintions.html')) {
                while($l = <$fh>) { print $l };
        }
}

print end_html;
