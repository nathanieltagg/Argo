#!/usr/bin/perl -w
use CGI::Pretty qw/:standard *table *tr start_Tr start_td start_ul start_tbody end_tbody *div/;
use CGI::Carp qw/warningsToBrowser fatalsToBrowser/;
use POSIX qw(strftime);
use Cwd qw/getcwd realpath/;
use HTML::Entities;

#
# Script to browse ROOT files on the server. Mild security hassle as viewers on the web
#  can see directory structrures and ROOT files.
#

#default configuration
$title =  "Arachne File Browser";
$default_path = "/minerva/data";
$cookie_name = 'argo_file_browser';
$cookie_name_recent = 'argo_file_browser_recent';
$link_target = "../arachne.html";
$restrict_to = [ getcwd(), "/uboone","/minos","/minerva","/pnfs"];
$quick_links = [ "/uboone/app", "/uboone/data", "/pnfs/uboone"];
$force_paths = [ "/uboone/app", "/uboone/data" ];

# Different configuration.
if( -r "file_browser_config.pl" ) {
    require "file_browser_config.pl" || die;
}  

sub get_filesize_str
{
    my $size = shift;
    if ($size > 1099511627776)  #   TiB: 1024 GiB
    {
        return sprintf("%.2f TB", $size / 1099511627776);
    }
    elsif ($size > 1073741824)  #   GiB: 1024 MiB
    {
        return sprintf("%.2f GB", $size / 1073741824);
    }
    elsif ($size > 1048576)       #   MiB: 1024 KiB
    {
        return sprintf("%.2f MB", $size / 1048576);
    }
    elsif ($size > 1024)            #   KiB: 1024 B
    {
        return sprintf("%.2f kB", $size / 1024);
    }
    else                                    #   bytes
    {
        return sprintf("%.2f bytes", $size);
    }
}
if(! -d $default_path) { $default_path = `pwd`; chomp $default_path;}

$cur_path = $default_path;
$cook_path = cookie($cookie_name);
if(defined $cook_path) {
   $cur_path = $cook_path;
}

# note: encoding prevents XSS attacks.
if(defined param('path')) {$cur_path = HTML::Entities::encode(param('path'));};


$cookie = cookie(-name=>$cookie_name,
                 -value=>$cur_path,
                 -expires=>'+1y',
                 -path=>'/');

print header(-cookie=>$cookie);


$scripts = [
            { -type => 'text/javascript',
              -src      => 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js'
            },
            { -type => 'text/javascript',
              # -src      => '../js/jquery.tablesorter.js'
              -src      => '../js/sorttable.js'
            },
            { -type => 'text/javascript',
              -src      => 'file_browser.js'}              
              ];
$stylesheets= ['file_browser.css'];

print start_html(
     -title=>$title
     # CSS
       , -style=>{-src=>$stylesheets
                 ,-media=>'all'
                 }
     # javascript
       ,-script=>$scripts
       );

print start_div{-id=>"content"};

print h2({-id=>"title"},$title);


# Resolve path to see if it's legal. NO poking around in /etc!
$req_path_abs = realpath($cur_path);
# Check to make sure it's rooted in an allowed area.
$good=0;
foreach $basepath (@$restrict_to)
{
  if( $req_path_abs=~/^$basepath/ ) {$good=1;}
}
if($good==0) {
  
  print p(HTML::Entities::encode("$cur_path"));
  print p("This path is not a standard file location. Contact Nathaniel if you need to see this area.");
  print p(@$restrict_to);

  print end_html;
  exit(0);
}

print start_div({id=>"cur_path"});
print b("Current Directory:");
@breakdown = split('/',$cur_path);
shift @breakdown;
$bp = "";
foreach $parent (@breakdown)
{
  $bp .= "/" . $parent ;
  print a({-href=>url()."?path=$bp"},$parent) . "/";
}
print end_div;
print br. br;

# Force open of critical paths.
foreach $path (@$force_paths) {
  opendir(IMDTMP, $path); close(IMDTMP);
  
}

# read directory.
if (! opendir(IMD, $cur_path) )
{ 
    print p("Cannot open directory $cur_path");
    print end_html; 
    exit(); 
};

@thefiles= readdir(IMD); 
closedir(IMD);

@thefiles = sort @thefiles;

@dirs= ();
@rootfiles=();
@ubdaqfiles=();
foreach $f (@thefiles)
{
  if ($f =~ /^\./) { next; }
  if( -d "$cur_path/$f" ) {push @dirs,$f;}
  if( $f =~ /\.root$/ ) {push @rootfiles,$f};
  if( $f =~ /\.ubdaq$/ ) {push @ubdaqfiles,$f};
}

if( scalar(@rootfiles) + scalar(@ubdaqfiles) ==0 ) {
  print p("No data files here.");
} 
if( scalar(@rootfiles) > 0 ) {
  print start_table({-class=>"filetable tablesorter"});
  print thead(Tr({-style=>"text-align:left;"},th("Larsoft Filename"),th("Date"),th({-class=>'sorttable_numeric'},"Size")));
  print start_tbody;
  foreach $f (@rootfiles)
  {
    @info = stat("$cur_path/$f");
    $f_enc = "$cur_path/$f";
    $f_enc =~ s/([^-_.~\/A-Za-z0-9])/sprintf("%%%02X", ord($1))/seg;
    print Tr(
             td( a({-href=>"$link_target#entry=0&filename=$f_enc"},"$f"))
            ,"<td sorttable_customkey=".$info[9]." class='date'>".strftime("%b %e, %Y %H:%M",localtime($info[9]))."</td>"
            ,"<td sorttable_customkey=".$info[7].">".get_filesize_str($info[7])."</td>"
            );
  }
  print end_tbody;
  print end_table;
}

if( scalar(@ubdaqfiles) > 0 ) {
  print start_table({-class=>"filetable tablesorter"});
  print thead(Tr({-style=>"text-align:left;"},th("Ubdaq Filename"),th("Date"),th({-class=>'sorttable_numeric'},"Size")));
  print start_tbody;
  foreach $f (@ubdaqfiles)
  {
    @info = stat("$cur_path/$f");
    $f_enc = "$cur_path/$f";
    $f_enc =~ s/([^-_.~\/A-Za-z0-9])/sprintf("%%%02X", ord($1))/seg;
    print Tr(
             td( a({-href=>"$link_target#entry=0&filename=$f_enc"},"$f"))
            ,"<td sorttable_customkey=".$info[9]." class='date'>".strftime("%b %e, %Y %H:%M",localtime($info[9]))."</td>"
            ,"<td sorttable_customkey=".$info[7].">".get_filesize_str($info[7])."</td>"
            );
  }
  print end_tbody;
  print end_table;
}

print  br . hr . b("Subdirectories:") . br;

foreach $f (@dirs)
{
  print div({-class=>"subdir"}, a({-href=>url()."?path=$cur_path/$f"},"$f/") );
}
print end_div; #content
print start_div({-class=>'push'}).end_div;;

print start_div({-id=>"footer"});
print b({-class=>"link"},"Quick links:");
foreach $f (@$quick_links) {
  print a({-class=>"link",-href=>url()."?path=$f"},"$f");
} 
foreach $f (@$recent_locations) {
  print a({-class=>"link",-href=>url()."?path=$f"},"$f");
} 
print end_div;

print end_html;
