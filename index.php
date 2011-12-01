<html>
<head>
	<link rel="stylesheet" href="style.css" type="text/css" media="screen">
	<link href="http://google-code-prettify.googlecode.com/svn/trunk/src/prettify.css" type="text/css" rel="stylesheet" />
	<script src="http://google-code-prettify.googlecode.com/svn/trunk/src/prettify.js" type="text/javascript"></script>
</head>
<body onload='var codeblocks = document.getElementsByTagName("code"); for (c in codeblocks) {if (codeblocks[c].parentNode && codeblocks[c].parentNode.nodeName == "PRE") codeblocks[c].className="prettyprint"}; prettyPrint();'>
<img src='logo.png' id='logo'/>
<div id='contents'>
<!--#exec cgi="cgi-bin/contents.cgi" -->
<?
	include_once("markdown.php");
	print Markdown(file_get_contents("README"));
?>
</div>

<h2>Unimplemented objects</h2>
<a onclick='document.getElementById("unimplemented").style.display="block";' href='#unimplemented' name='unimplemented'>(show)</a>
<div id='unimplemented'>
<p>Implemented objects are prefixed with a '&gt;', whilst unimplemented objects are prefixed with a '&lt;'.</p>
<pre>
<!--#include file='OBJECTS.txt' -->
<?= file_get_contents("OBJECTS.txt") ?>;
</pre>
</div>

<!-- Piwik -->
<script type="text/javascript">
var pkBaseURL = (("https:" == document.location.protocol) ? "https://stats.mccormick.cx/" : "http://stats.mccormick.cx/");
document.write(unescape("%3Cscript src='" + pkBaseURL + "piwik.js' type='text/javascript'%3E%3C/script%3E"));
</script><script type="text/javascript">
try {
var piwikTracker = Piwik.getTracker(pkBaseURL + "piwik.php", 1);
piwikTracker.trackPageView();
piwikTracker.enableLinkTracking();
} catch( err ) {}
</script><noscript><p><img src="http://stats.mccormick.cx/piwik.php?idsite=1" style="border:0" alt="" /></p></noscript>
<!-- End Piwik Tracking Code -->

</body>
</html>
