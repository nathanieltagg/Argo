#!/usr/bin/perl -w

use CGI::Session;
use CGI::Pretty qw(:standard *div *table);

my $cgi = $CGI::Q;
# my $session = new CGI::Session("driver:sqlite", $cgi, {DataSource=>'./sessions.sql'})
#                    or die CGI::Session::errstr;


print header . 
	CGI::start_html( -title=>"SamWebSpider", 
					 -style=>[{-src=>"samspider.css",-media=>'all'}], 
					 -script=>[{ -type => 'text/javascript', -src => "samspider.js" }],
					 -head=>Link({-rel=>'icon', -type=>'image/png', -href=>'../images/icon.png'})
					  );
print h1("SamSpider");

if(param('def')) {
	my $definition = param('def');
	print h3("Using data defintion: " . $definition);
} else {

        # No definition set defined. Give the user options.
        print h3("Click through the list below to find your desired dataset defintion.");

        my $def_prefix = param("def_starts_with") || "";
        print start_div({-class=>"samweb_definitions"});
		system("./samdef-organizer $def_prefix");
		print end_div;


        print h3("Links to some useful definitions");
        if(open(my $fh, '<', 'interesting_defintions.html')) {
                while($l = <$fh>) { print $l };
        }
}
print end_html;
