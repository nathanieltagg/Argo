#!/usr/bin/perl -w

# use CGI::Session;
use CGI::Pretty qw(:standard *div *table);
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
use File::Spec;
use URI::Escape;

my $cgi = $CGI::Q;

$|=1;


$samweb = "/grid/fermiapp/products/common/prd/sam_web_client/v2_0/NULL/bin/samweb -e uboone ";

# copy URL params into post, if there are both
for my $p (url_param){
  param(-name=>$p, -value=>url_param($p));
}


my $logtext;
open(LOG, ">", \$logtext);

$title = 'SamWebSpider ';
# if(param("file")) { $title .= param('file');}
# elsif(param("def"))  { $title .= param('def');}
# elsif(param("def_starts_with"))  { $title .= param('def_starts_with');}

my $event  = param('event');
my $subrun = param('subrun') || 0;
my $run    = param('run') || 0;
my $project  =  param('project');
my $defname= param('defname');
 
print LOG "$run|$subrun|$event" . br;

# full samweb dimensions at
# http://samweb.fnal.gov:8480/sam/uboone/api/files/list/dimensions
# note however that first_event and last_event are cocked up

$query = "run_number=$run.$subrun";
if(defined $defname) {
  $query .= " and defname:$defname";
}
if(defined $project) {
  $query .= " and ub_project.name=$project";
}
$cmd = "$samweb list-files \"$query\"";
print LOG $cmd . br;
open(my $fh, "$cmd |") or die "Can't open samweb. Contact Nathaniel";
my $file = "";
while(	<$fh> ) { 
  print LOG "file: $_" . br;
  $file = $_; 
}  # get most recent file
$file =~ s/\s+$//;  #trim whitespace
close $fh;
print LOG $file . br;

# $cmd = "$samweb get-metadata -json $file";
# open($fh, "$cmd |") or die "Can't open samweb. Contact Nathaniel";
# $n = 0;
# $dirname = "";
# while(  $samloc = <$fh> ) {
#   print LOG "location: " . $samloc . br;
#   $n++;
#   if($samloc =~ /^enstore/) {
#     chomp $samloc;
#     $dirname = ($samloc =~ /(\/.*)\(/)[0];
#     $dirname =~ s/\s+$//;  #trim whitespace
#   }
# }
# close $fh;


$cmd = "$samweb locate-file $file";
open($fh, "$cmd |") or die "Can't open samweb. Contact Nathaniel";
$n = 0;
$dirname = "";
while(	$samloc = <$fh> ) {
  print LOG "location: " . $samloc . br;
  $n++;
	if($samloc =~ /^enstore/) {
    chomp $samloc;
		$dirname = ($samloc =~ /(\/.*)\(/)[0];			
    $dirname =~ s/\s+$//;  #trim whitespace
	}
}
close $fh;

my $argolink = "";
if(length($dirname)>0) {

  $path = "$dirname/$file";
  print LOG "$path".br;


  $selection="1";
  if(defined $event) {
    if($project=~/anatree/) {
      $selection=uri_escape("event==$event");
    } else {
      $selection=uri_escape("EventAuxiliary.id_.event_==$event");
    }
  }
  $argolink = "./#filename=$path&selection=$selection&entry=0";


  if(param(t1))     { $argolink .= "&t1=". param(t1); }
  if(param(t2))     { $argolink .= "&t2=". param(t2); }
  if(param(plane0)) { $argolink .= "&plane0=". param(plane0); }
  if(param(plane1)) { $argolink .= "&plane1=". param(plane1); }
  if(param(plane2)) { $argolink .= "&plane2=". param(plane2); }
  if(param(wires))  { $argolink .= "&wires=". param(wires); }
  print LOG $argolink .br;

  
}

if(length($argolink)>0) {

  print LOG a({-href=>$argolink},$argolink).br;
  print "Location:  $argolink\n\n";
  exit(1);

}



print header . 
	CGI::start_html( -title=>$title, 
					 -style=>[ {-src=>"samspider/samspider.css",-media=>'all'}
					 	     , {-src=>"https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/themes/smoothness/jquery-ui.css",-media=>'all'}
					 	], 
					 -script=>[ {-type => 'text/javascript', -src => "https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js"}
					 		  , {-type => 'text/javascript', -src => "https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js"}
					 		  , {-type => 'text/javascript', -src => "samspider.js"}
					          ],
					 -head=>Link({-rel=>'icon', -type=>'image/png', -href=>'.images/icon.png'})
					  );

print $logtext;
print end_html;


